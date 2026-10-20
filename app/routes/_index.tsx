import { useEffect, useState } from "react";
import { APP_TITLE } from "@/lib/app-config";
import { RumpelGame } from "@/components/RumpelGame";

export function meta() {
  return [
    { title: "Rumpel's Tiptoe Barn" },
    {
      name: "description",
      content: "Tiptoe around the barn and spin hay into gold.",
    },
  ];
}

export default function HomeRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-full flex-1 overflow-auto bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Rumpel&apos;s <span className="text-secondary">Tiptoe</span> Barn
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            Shh... spin the hay into gold, then show her the dance. ({APP_TITLE})
          </p>
        </header>
        {mounted ? <RumpelGame /> : null}
      </div>
    </div>
  );
}
