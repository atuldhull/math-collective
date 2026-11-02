import { useId, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

export default function InputField({
  label,
  helper,
  error,
  prefix,
  multiline = false,
  className,
  inputClassName,
  ...props
}) {
  const generatedId = useId();
  const [focused, setFocused] = useState(false);
  const fieldId = props.id || generatedId;
  const Tag = multiline ? "textarea" : "input";
  const statusText = error || helper;
  const lamp = useIsLamplight();

  return (
    <label htmlFor={fieldId} className={cn("block", className)}>
      {label ? (
        <span className={cn("block", lamp ? "mb-2 text-[13px] font-medium text-text-muted" : "mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-text-muted")}>
          {label}
        </span>
      ) : null}

      <motion.div
        animate={{ y: focused ? -1 : 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(
          "relative flex items-start gap-3 px-4 py-3 transition-all duration-200 ease-in-out",
          lamp
            ? cn(
              "overflow-hidden rounded-xl border bg-surface/70 backdrop-blur",
              error ? "border-danger/50" : focused ? "border-[rgb(var(--lamp)/0.55)] shadow-[0_0_0_4px_rgb(var(--lamp)/0.10)]" : "border-[rgb(var(--rule))] hover:border-line/30",
            )
            : cn("bg-panel/70", error ? "shadow-[0_0_0_1px_rgb(var(--color-danger)/0.12)]" : ""),
        )}
        style={lamp ? undefined : {
          border: "none",
          borderBottom: focused
            ? "1.5px solid var(--page-accent)"
            : error
              ? "1.5px solid rgb(var(--color-danger)/0.5)"
              : "1.5px solid rgb(var(--color-text-primary)/0.2)",
          borderLeft: "3px solid var(--page-accent)",
          boxShadow: focused ? "0 2px 8px var(--page-glow)" : "none",
        }}
      >

        {lamp ? (
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{ scaleX: focused ? 1 : 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary"
          />
        ) : null}

        {prefix ? (
          <span className={cn("pt-1", lamp ? "text-sm text-primary" : "font-mono text-xs uppercase tracking-[0.22em] text-primary/80")}>
            {prefix}
          </span>
        ) : null}

        <Tag
          id={fieldId}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "min-h-[1.5rem] w-full resize-none bg-transparent text-sm leading-7 outline-none placeholder:text-text-dim",
            lamp ? "text-text-primary" : "text-white",
            multiline ? "min-h-[7rem]" : "",
            inputClassName,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </motion.div>

      {statusText ? (
        <p
          className={cn(
            "mt-3 text-sm leading-6",
            error ? "text-danger" : "text-text-dim",
          )}
        >
          {statusText}
        </p>
      ) : null}
    </label>
  );
}
