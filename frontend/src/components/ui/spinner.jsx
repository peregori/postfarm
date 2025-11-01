import { LoaderIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function Spinner({ className, size = 24, ...props }) {
  return (
    <LoaderIcon
      className={cn("animate-spin", className)}
      size={size}
      {...props}
    />
  )
}

