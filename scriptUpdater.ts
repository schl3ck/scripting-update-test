import { Path, Response, Script, fetch } from "scripting"

export const updateCheckIntervalValues = [
  "every time", "daily", "weekly", "monthly"
] as const
export type UpdateCheckInterval = typeof updateCheckIntervalValues[number]
export interface VersionData {
  version: string
  date: string
  notes: string
  url: string
}
export interface StorageData {
  lastChecked: number
  versions: VersionData[]
}

const storageKey = `scriptUpdater.${Script.name}`
const unzippedFolder = Path.join(FileManager.temporaryDirectory, "scriptUpdate")
const scriptBackup = Script.directory + "_updateBackup"

/**
 * Fetch the versions file (depending on the update interval) and return all newer versions than the current one.
 *
 * @param url URL pointing to the `version.json` file. A simple GET request is made so no authentication is supported.
 * @param interval Interval to check for updates. If this function is called within this interval then no request is made and only the cache is looked up.
 * @param currentVersion Current version of the script. The forms a, a.b, a.b.c, a.b.c.d are supported.
 */
export async function updateAvailable(
  url: string,
  interval: UpdateCheckInterval,
  currentVersion: string,
) {
  const cached: StorageData = Storage.get<StorageData>(storageKey)
    ?? {
      lastChecked: 0,
      versions: [],
    }
  const intervalDates: Record<UpdateCheckInterval, Date> = {
    ["every time"]: new Date(),
    daily: getIntervalDate(),
    weekly: getIntervalDate(d => d.setDate(d.getDate() - 7)),
    monthly: getIntervalDate(d => d.setMonth(d.getMonth() - 1)),
  }
  if (cached.lastChecked <= intervalDates[interval].getTime()) {
    const response = await fetch(url)
    cached.versions = await response.json() as VersionData[]
    cached.lastChecked = new Date().getTime()

    // save updated cache
    if (!Storage.set(storageKey, cached)) {
      console.log("WARNING: could not write update data to Storage")
    }
  }

  const newVersions = cached
    .versions
    .filter(v => compareVersion(v.version, currentVersion) > 0)
  return newVersions
}

function getIntervalDate(adjust?: (d: Date) => void) {
  const d = new Date()
  adjust && adjust(d)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Return the cached data containing all versions and the last time it was updated
*/
export function getCache() {
  return Storage.get<StorageData>(storageKey)
}

export async function downloadUpdate(url: string) {
  const path = Path.join(FileManager.temporaryDirectory, "scriptUpdate.zip")
  const response = await fetch(url)
  if (!response.ok) {
    throw new DownloadError(url, response)
  }
  const data = Data.fromArrayBuffer(await response.bytes())
  if (!data) {
    throw new Error("Could not convert from ArrayBuffer to data")
  }
  await FileManager.writeAsData(path, data)
  if (!FileManager.existsSync(unzippedFolder)) {
    await FileManager.createDirectory(unzippedFolder, true)
  }
  await FileManager.unzip(path, unzippedFolder)

  return FileManager.readDirectory(unzippedFolder, true)
}

export async function installDownloadedScript() {
  await FileManager.rename(Script.directory, scriptBackup)
  await FileManager.rename(unzippedFolder, Script.directory)
}

export async function cleanFiles() {
  if (await FileManager.exists(scriptBackup)) {
    await FileManager.remove(scriptBackup)
  }
  if (await FileManager.exists(unzippedFolder)) {
    await FileManager.remove(unzippedFolder)
  }
}

/**
 * Compare two versions. This can be used in the Array.sort() function. Only supports versions of the form a.b(...). No alpha, beta or other pre-release versions are supported.
 *
 * Returns `0` if they equal, less than `0` if `a` is less than `b` and greater than `0` if `a` is greater than `b`.
 */
export function compareVersion(a: string, b: string): number {
  const regex = /^\d+(?:\.\d+){0,3}$/
  if (!regex.test(a)) {
    throw new Error(`Parameter "a" is not a version: "${a}"`)
  }
  if (!regex.test(b)) {
    throw new Error(`Parameter "b" is not a version: "${b}"`)
  }
  const aParts = a.split(".").map(i => parseInt(i))
  const bParts = b.split(".").map(i => parseInt(i))
  if (aParts.length < bParts.length) {
    aParts.push(...(new Array(bParts.length - aParts.length).fill(0)))
  }
  if (bParts.length < aParts.length) {
    bParts.push(...(new Array(aParts.length - bParts.length).fill(0)))
  }

  for (let i = 0; i < aParts.length; i++) {
    const result = aParts[i] - bParts[i]
    if (result !== 0) return result
  }
  return 0
}

export class DownloadError {
  url: string
  response: Response

  constructor(url: string, response: Response) {
    this.url = url
    this.response = response
  }

  toString() {
    return `Failed to download the update from ${this.url}: ${this.response.status} ${this.response.statusText}`
  }
}
