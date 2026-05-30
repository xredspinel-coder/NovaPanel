import { motion } from "framer-motion";

export function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-line bg-panel/88 p-4 shadow-[0_16px_46px_rgb(0_0_0/0.12)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text/46">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-text">{value}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
      </div>
      {detail ? <p className="mt-3 text-sm text-text/58">{detail}</p> : null}
    </motion.div>
  );
}
