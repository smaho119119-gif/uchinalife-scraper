import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border-2 px-3 py-1 text-xs font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all overflow-hidden shadow-md",
  {
    variants: {
      variant: {
        default:
          "border-cyan-700 bg-cyan-500 text-white [a&]:hover:bg-cyan-600 dark:border-cyan-400 dark:bg-cyan-600",
        secondary:
          "border-fuchsia-700 bg-fuchsia-500 text-white [a&]:hover:bg-fuchsia-600 dark:border-fuchsia-400 dark:bg-fuchsia-600",
        destructive:
          "border-rose-700 bg-rose-500 text-white [a&]:hover:bg-rose-600 dark:border-rose-400 dark:bg-rose-600",
        outline:
          "border-slate-900 dark:border-white text-slate-900 dark:text-white bg-white dark:bg-slate-900 [a&]:hover:bg-slate-100 dark:[a&]:hover:bg-slate-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
