import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return <div className="flex h-dvh items-center justify-center bg-canvas text-muted"><LoaderCircle className="h-6 w-6 animate-spin" /></div>;
}
