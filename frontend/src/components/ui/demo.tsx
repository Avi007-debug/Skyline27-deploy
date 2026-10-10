"use client"

import ShutterGlyphFooter from "@/components/ui/shutter-glyph-footer"

// The same footer re-branded and re-inked: bone on black, the shutter on the
// third letter, other links, and a signup handler that can fail — try
// fail@example.com to see the error state.
export default function Demo() {
  return (
    <div className="w-full bg-[#111110]">
      <ShutterGlyphFooter
        brand="Verso"
        company="Verso Type & Print"
        since={2017}
        background="#111110"
        ink="#efe9dc"
        signupLabel="Monthly letters from the print room"
        placeholder="Your email"
        socials={[
          { label: "Are.na", href: "#" },
          { label: "Instagram", href: "#" },
          { label: "Bandcamp", href: "#" },
        ]}
        legal={[
          { label: "Imprint", href: "#" },
          { label: "Privacy", href: "#" },
        ]}
        onSubscribe={async (email) => {
          await new Promise((r) => setTimeout(r, 900))
          return !email.startsWith("fail@")
        }}
        onLinkClick={(label) => console.log("footer link:", label)}
      />
    </div>
  )
}
