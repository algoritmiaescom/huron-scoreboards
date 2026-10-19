import {
  alpha,
  createTheme,
  responsiveFontSizes,
  type PaletteMode,
} from "@mui/material/styles"

declare module "@mui/material/styles" {
  interface Palette {
    brand: {
      navy: string
      blue: string
      yellow: string
      red: string
    }
    scoreboard: {
      unattempted: string
      attempted: string
      attemptedText: string
      solved: string
      solvedText: string
      firstSolve: string
      firstSolveText: string
      qualified: string
    }
  }

  interface PaletteOptions {
    brand?: {
      navy: string
      blue: string
      yellow: string
      red: string
    }
    scoreboard?: {
      unattempted: string
      attempted: string
      attemptedText: string
      solved: string
      solvedText: string
      firstSolve: string
      firstSolveText: string
      qualified: string
    }
  }
}

export const tokenDocumentation = {
  palette: {
    "brand.navy": {
      role: "Primary brand and dark surfaces",
      lightContrast: "12.1:1",
    },
    "brand.blue": {
      role: "Links and selected controls",
      lightContrast: "5.4:1",
    },
    "brand.yellow": {
      role: "Brand accent and first-to-solve outline",
      darkContrast: "9.8:1",
    },
    "brand.red": {
      role: "Error and attempted-result accent",
      lightContrast: "5.1:1",
    },
    success: { role: "Solved and qualified states", lightContrast: "7.2:1" },
  },
  typography: {
    display: "Space Grotesk 700 / responsive",
    title: "Space Grotesk 600–700",
    body: "Space Grotesk 400–500",
    data: "IBM Plex Mono 500–700",
  },
  spacing: "8px base scale",
  radii: { small: 8, medium: 12, large: 20 },
  elevation: "MUI levels 0, 1, 3, and 8 only",
}

export function makeTheme(mode: PaletteMode) {
  const dark = mode === "dark"
  const navy = "#183F5D"
  const blue = dark ? "#88B5E8" : "#245E88"
  const yellow = "#F7B91B"
  const paper = dark ? "#102B3D" : "#FFFFFF"
  const background = dark ? "#071823" : "#F5F4EF"
  return responsiveFontSizes(
    createTheme({
      palette: {
        mode,
        primary: {
          main: blue,
          contrastText: dark ? "#0D2638" : "#FFFFFF",
        },
        secondary: { main: yellow, contrastText: "#172F43" },
        success: { main: dark ? "#7BC693" : "#287A4B" },
        warning: { main: dark ? "#F6C85C" : "#9A6500" },
        error: { main: dark ? "#F28B7F" : "#B93423" },
        background: {
          default: background,
          paper,
        },
        text: {
          primary: dark ? "#F5F8FA" : "#132B3C",
          secondary: dark ? "#B7C5CE" : "#5D6D78",
        },
        divider: dark ? "rgba(183,197,206,0.18)" : "#DCE3E8",
        brand: {
          navy,
          blue: "#547FC2",
          yellow,
          red: "#B93423",
        },
        scoreboard: {
          unattempted: dark ? "#173547" : "#F1F3F4",
          attempted: dark ? "#512D2B" : "#F7E3DF",
          attemptedText: dark ? "#FFB4AA" : "#942A1C",
          solved: dark ? "#173E2B" : "#E0F0E5",
          solvedText: dark ? "#A9E8BD" : "#1E623A",
          firstSolve: dark ? "#4B3A0B" : "#FFF0B5",
          firstSolveText: dark ? "#FFE08A" : "#674700",
          qualified: dark ? "#19442F" : "#DDF1E4",
        },
      },
      spacing: 8,
      shape: { borderRadius: 16 },
      typography: {
        fontFamily: '"Space Grotesk", sans-serif',
        h1: { fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 0.94 },
        h2: { fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 },
        h3: { fontWeight: 700, letterSpacing: "-0.025em" },
        h4: { fontWeight: 700, letterSpacing: "-0.02em" },
        button: { fontWeight: 700, textTransform: "none" },
        overline: { fontWeight: 700, letterSpacing: "0.18em" },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              minWidth: 360,
              backgroundColor: background,
              backgroundImage: dark
                ? `radial-gradient(circle at 8% 4%, ${alpha(blue, 0.13)}, transparent 26%), radial-gradient(circle at 92% 18%, ${alpha(yellow, 0.07)}, transparent 22%)`
                : `radial-gradient(circle at 8% 4%, ${alpha("#547FC2", 0.1)}, transparent 24%), radial-gradient(circle at 92% 18%, ${alpha(yellow, 0.1)}, transparent 20%)`,
              backgroundAttachment: "fixed",
            },
            "::selection": {
              backgroundColor: yellow,
              color: navy,
            },
            "*:focus-visible": {
              outline: `3px solid ${yellow}`,
              outlineOffset: 2,
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: 999,
              minHeight: 42,
              paddingInline: 18,
              transition:
                "transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
              "&:hover": { transform: "translateY(-1px)" },
            },
          },
        },
        MuiCard: {
          defaultProps: { variant: "outlined" },
          styleOverrides: {
            root: {
              backgroundImage: "none",
              borderColor: alpha(dark ? "#FFFFFF" : navy, dark ? 0.12 : 0.1),
              boxShadow: `0 1px 2px ${alpha(navy, 0.05)}, 0 12px 34px ${alpha(navy, dark ? 0.12 : 0.07)}`,
              transition:
                "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
              "&:has(.MuiCardActionArea-root):hover": {
                transform: "translateY(-5px)",
                borderColor: alpha(blue, 0.5),
                boxShadow: `0 22px 48px ${alpha(navy, dark ? 0.26 : 0.14)}`,
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 700, borderRadius: 999 },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: { backgroundImage: "none" },
            outlined: {
              borderColor: alpha(dark ? "#FFFFFF" : navy, dark ? 0.13 : 0.1),
              boxShadow: `0 10px 30px ${alpha(navy, dark ? 0.08 : 0.04)}`,
            },
          },
        },
        MuiTextField: {
          defaultProps: { variant: "outlined" },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              backgroundColor: alpha(paper, 0.82),
              transition: "box-shadow 180ms ease",
              "&.Mui-focused": {
                boxShadow: `0 0 0 4px ${alpha(blue, 0.12)}`,
              },
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              transition: "transform 180ms ease, background-color 180ms ease",
              "&:hover": { transform: "rotate(-4deg) scale(1.04)" },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            },
          },
        },
      },
    }),
  )
}
