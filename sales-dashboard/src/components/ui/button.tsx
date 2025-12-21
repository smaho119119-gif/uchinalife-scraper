import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none border-3 shadow-lg hover:scale-105",
  {
    variants: {
      variant: {
        default: "bg-cyan-500 text-white border-cyan-700 hover:bg-cyan-600 dark:bg-cyan-600 dark:border-cyan-400",
        destructive:
          "bg-rose-500 text-white border-rose-700 hover:bg-rose-600 dark:bg-rose-600 dark:border-rose-400",
        outline:
          "border-3 border-slate-900 dark:border-white bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800",
        secondary:
          "bg-fuchsia-500 text-white border-fuchsia-700 hover:bg-fuchsia-600 dark:bg-fuchsia-600 dark:border-fuchsia-400",
        ghost:
          "border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white",
        link: "text-cyan-600 dark:text-cyan-400 underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-9 rounded-lg gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 rounded-lg px-7 has-[>svg]:px-5 text-base",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
