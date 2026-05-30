import { motion } from "framer-motion";

export function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-line bg-panel p-4 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
      </div>
      {detail ? <p className="mt-3 text-sm text-white/50">{detail}</p> : null}
    </motion.div>
  );
}
