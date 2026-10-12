import { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  Play,
  Code2,
  Users,
  TrendingUp,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import { getAnalyticsSummary } from '../services/analyticsService';

// ─── GitHub-style heatmap ───

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function Heatmap({ data, theme }) {
  const t = getThemeClasses(theme);

  const weeks = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Start from 52 weeks ago, aligned to Sunday
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 364);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const cols = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const key = dayKey(cursor);
        const entry = data?.[key];
        week.push({ date: new Date(cursor), key, count: entry?.total || 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      cols.push(week);
    }
    return cols;
  }, [data]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const w of weeks) for (const d of w) max = Math.max(max, d.count);
    return max || 1;
  }, [weeks]);

  const colorFor = (count) => {
    if (count === 0) return 'bg-(--ink)/8';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'bg-(--acid)/25';
    if (intensity < 0.5) return 'bg-(--acid)/50';
    if (intensity < 0.75) return 'bg-(--acid)/75';
    return 'bg-(--acid)';
  };

  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = week[0].date.getUTCMonth();
      if (m !== lastMonth && wi > 0) {
        labels.push({
          index: wi,
          label: week[0].date.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  const totalActive = useMemo(() => {
    let n = 0;
    for (const w of weeks) for (const d of w) if (d.count > 0) n++;
    return n;
  }, [weeks]);

  return (
    <div>
      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="inline-block min-w-full">
          <div className="relative" style={{ paddingLeft: 0 }}>
            <div className="flex gap-[3px] mb-1 relative h-4">
              {monthLabels.map((l) => (
                <span
                  key={l.index}
                  className={`absolute font-mono text-[10px] ${t.textMuted}`}
                  style={{ left: l.index * 13 }}
                >
                  {l.label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => {
                    const isFuture = day.date > new Date();
                    return (
                      <div
                        key={di}
                        title={`${day.key}: ${day.count} activit${day.count === 1 ? 'y' : 'ies'}`}
                        className={`w-[10px] h-[10px] rounded-[2px] transition-transform hover:scale-125 ${isFuture ? 'opacity-0' : colorFor(day.count)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={`flex items-center justify-between mt-2 font-mono text-[10px] ${t.textMuted}`}>
        <span>{totalActive} active days in the last year</span>
        <span className="flex items-center gap-1">
          Less
          <span className="w-[10px] h-[10px] rounded-[2px] bg-(--ink)/8 inline-block" />
          <span className="w-[10px] h-[10px] rounded-[2px] bg-(--acid)/25 inline-block" />
          <span className="w-[10px] h-[10px] rounded-[2px] bg-(--acid)/50 inline-block" />
          <span className="w-[10px] h-[10px] rounded-[2px] bg-(--acid)/75 inline-block" />
          <span className="w-[10px] h-[10px] rounded-[2px] bg-(--acid) inline-block" />
          More
        </span>
      </div>
    </div>
  );
}

// ─── Language bars ───

const LANG_COLORS = {
  python: '#4d7fff',
  javascript: '#d9ff3f',
  cpp: '#ff4d35',
  java: '#ffd23f',
};

function LanguageBars({ languages, theme }) {
  const t = getThemeClasses(theme);
  const total = languages.reduce((s, l) => s + l.count, 0) || 1;
  const top = languages.slice(0, 5);

  if (!languages.length) {
    return <p className={`font-mono text-[12px] ${t.textMuted} py-4 text-center`}>Run some code to see language stats!</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {top.map((l) => {
        const pct = Math.round((l.count / total) * 100);
        return (
          <div key={l.name}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-mono text-[12px] font-bold ${t.textPrimary} capitalize`}>{l.name}</span>
              <span className={`font-mono text-[11px] ${t.textMuted}`}>{l.count} runs · {pct}%</span>
            </div>
            <div className={`h-2 rounded-full bg-(--ink)/8 overflow-hidden`}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: LANG_COLORS[l.name] || 'var(--blue)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Weekly bars ───

function WeeklyBars({ weekly, theme }) {
  const t = getThemeClasses(theme);
  const data = useMemo(() => {
    // Fill last 12 weeks, even empty ones
    const map = new Map(weekly.map((w) => [w.week, w.count]));
    const out = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const year = d.getUTCFullYear();
      const weekNum = String(
        Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + new Date(Date.UTC(year, 0, 1)).getUTCDay() + 1) / 7)
      ).padStart(2, '0');
      const key = `${year}-${weekNum}`;
      out.push({ week: key, count: map.get(key) || 0, label: i === 0 ? 'now' : `${i}w` });
    }
    return out;
  }, [weekly]);

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div
            title={`${d.count} runs`}
            className={`w-full rounded-t-md transition-all duration-500 ${d.count > 0 ? 'bg-(--blue)' : 'bg-(--ink)/8'}`}
            style={{ height: `${Math.max(6, (d.count / max) * 100)}%`, opacity: d.count > 0 ? 0.35 + 0.65 * (d.count / max) : 1 }}
          />
          {i % 3 === 0 && <span className={`font-mono text-[9px] ${t.textMuted}`}>{d.label}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Main section ───

function StatCard({ icon: Icon, label, value, sub, accent, t }) {
  return (
    <div className={`${t.card} p-4 flex items-start gap-3.5 animate-fade-up`}>
      <span
        className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
        style={{ borderColor: `${accent}44`, background: `${accent}18`, color: accent }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${t.textMuted}`}>{label}</p>
        <p className={`text-[22px] font-extrabold tracking-tight ${t.textPrimary} leading-tight`}>{value}</p>
        {sub && <p className={`font-mono text-[11px] ${t.textMuted} mt-0.5`}>{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsSection({ theme }) {
  const t = getThemeClasses(theme);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAnalyticsSummary()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`${t.card} p-10 flex items-center justify-center gap-2`}>
        <Loader2 size={16} className="animate-spin" />
        <span className={`font-mono text-[13px] ${t.textMuted}`}>Crunching numbers…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${t.card} p-8 text-center`}>
        <p className={`text-[13px] ${t.textMuted}`}>Couldn&apos;t load analytics. Run some code first! 🚀</p>
      </div>
    );
  }

  const hasActivity = data.totals.runs > 0 || Object.keys(data.heatmap || {}).length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-(--blue)/12 border border-(--blue)/30 flex items-center justify-center">
          <TrendingUp size={15} className="text-(--blue)" />
        </span>
        <div>
          <h2 className={`text-[16px] font-extrabold tracking-tight ${t.textPrimary}`}>Your coding analytics</h2>
          <p className={`font-mono text-[11px] ${t.textMuted}`}>last 30 days · runs, streaks & languages</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          t={t}
          icon={Flame}
          label="Day streak"
          value={`${data.streaks.current} 🔥`}
          sub={`longest: ${data.streaks.longest} days`}
          accent="#ff4d35"
        />
        <StatCard
          t={t}
          icon={Play}
          label="Code runs"
          value={data.totals.runs.toLocaleString()}
          sub="executions this month"
          accent="#1557ff"
        />
        <StatCard
          t={t}
          icon={Code2}
          label="Lines written"
          value={data.totals.lines.toLocaleString()}
          sub="non-empty lines run"
          accent="#d9ff3f"
        />
        <StatCard
          t={t}
          icon={Users}
          label="Rooms"
          value={data.totals.rooms}
          sub="joined / created"
          accent="#c678dd"
        />
      </div>

      {/* Heatmap */}
      <div className={`${t.card} p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={14} className={t.textMuted} />
          <h3 className={`text-[14px] font-extrabold ${t.textPrimary}`}>Activity</h3>
        </div>
        {hasActivity ? (
          <Heatmap data={data.heatmap} theme={theme} />
        ) : (
          <p className={`font-mono text-[12px] ${t.textMuted} py-6 text-center`}>
            No activity yet — run some code and your heatmap will light up! 🟩
          </p>
        )}
      </div>

      {/* Languages + Weekly */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className={`${t.card} p-5`}>
          <h3 className={`text-[14px] font-extrabold ${t.textPrimary} mb-4`}>Top languages</h3>
          <LanguageBars languages={data.languages} theme={theme} />
        </div>
        <div className={`${t.card} p-5`}>
          <h3 className={`text-[14px] font-extrabold ${t.textPrimary} mb-4`}>Runs per week</h3>
          <WeeklyBars weekly={data.weekly} theme={theme} />
        </div>
      </div>
    </div>
  );
}
