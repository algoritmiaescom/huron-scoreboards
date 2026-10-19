import { CssBaseline, ThemeProvider } from "@mui/material"
import { createContext, useMemo, useState } from "react"
import { RouterProvider } from "react-router"
import { makeTheme } from "@/theme"
import { router } from "./routes"

export const ColorModeContext = createContext<{ toggle: () => void }>({
  toggle: () => undefined,
})

export default function App() {
  const [mode, setMode] = useState<"light" | "dark">("light")
  const controls = useMemo(
    () => ({
      toggle: () => setMode((value) => (value === "light" ? "dark" : "light")),
    }),
    [],
  )
  const theme = useMemo(() => makeTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={controls}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
