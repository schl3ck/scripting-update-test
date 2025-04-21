import { Button, EmptyView, HStack, List, Navigation, NavigationLink, NavigationStack, Picker, ProgressView, Script, Spacer, Text, TextField, useCallback, useState } from "scripting"
import { cleanFiles, downloadUpdate, getCache, StorageData, updateAvailable, UpdateCheckInterval, updateCheckIntervalValues, VersionData } from "./scriptUpdater"

const versionsUrl = ""

run()

async function run() {
  await Navigation.present(<MainView />)
  Script.exit()
}

function MainView() {
  const [versions, setVersions] = useState<VersionData[]>(() => [])
  const [interval, setInterval] = useState<UpdateCheckInterval>("every time")
  const [version, setVersion] = useState("0.1")
  const [cache, setCache] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(false)

  const checkVersion = useCallback(async () => {
    setLoading(true)
    try {
      setVersions(await updateAvailable(versionsUrl, interval, version))
    } catch (error) {
      console.error(error)
      console.present()
    }
    setCache(getCache())
    setLoading(false)
  }, [interval, version])

  const download = useCallback(async () => {
    setLoading(true)
    try {
      await downloadUpdate(versions[versions.length - 1].url)
    } catch (error) {
      console.error(error)
      console.present()
    }
    setLoading(false)
  }, [versions])

  const clean = useCallback(async () => {
    setLoading(true)
    try {
      await cleanFiles()
    } catch (error) {
      console.error(error)
      console.present()
    }
    setLoading(false)
  }, [])
  const dismiss = Navigation.useDismiss()

  return <NavigationStack>
    <List
      toolbar={{
        cancellationAction: <Button
          title="Close"
          action={dismiss}
        />
      }}
    >
      <TextField
        title="Version"
        value={version}
        onChanged={setVersion}
        disabled={loading}
      />
      <Picker
        title="Interval"
        pickerStyle="menu"
        value={interval}
        onChanged={(v: string) => setInterval(v as UpdateCheckInterval)}
      >
        {
          updateCheckIntervalValues.map(i =>
            <Text tag={i}>{i}</Text>
          )
        }
      </Picker>
      <NavigationLink
        destination={<Versions versions={cache?.versions ?? []} />}
        disabled={!cache}
      >
        <HStack>
          <Text>Cache</Text>
          <Spacer />
          <Text>
            {
              cache
                ? new Date(cache.lastChecked).toLocaleString()
                : "never checked"
            }
          </Text>
        </HStack>
      </NavigationLink>
      <Button
        action={checkVersion}
      >
        <HStack>
          <Text>Check for update</Text>
          {
            loading
              ? <ProgressView progressViewStyle="circular" />
              : <EmptyView />
          }
        </HStack>
      </Button>
      <NavigationLink
        title="Versions"
        destination={<Versions versions={versions} />}
      />
      <Button
        title="Download update"
        action={download}
      />
      <Button
        title="Clean files"
        action={clean}
      />
    </List>
  </NavigationStack>
}

function Versions({
  versions,
}: {
  versions: VersionData[]
}) {
  const text = versions.map(v => `## ${v.version} - ${v.date}

${v.notes}
`).join("\n\n")

  return <NavigationStack>
    <Text
      padding
      attributedString={text}
    />
  </NavigationStack>

}

