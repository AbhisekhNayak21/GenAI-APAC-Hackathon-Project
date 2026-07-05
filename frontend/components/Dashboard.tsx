"use client";

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { UploadCloud, Activity, Send, CheckCircle2, Clock, FileText, AlertTriangle, HelpCircle, User, Calendar, ShieldAlert, Download } from 'lucide-react';

const COLORS_TASK = ['#eab308', '#3b82f6', '#22c55e']; // Pending, In Progress, Completed
const COLORS_STATUS = ['#22c55e', '#3b82f6', '#ef4444']; // Decided, Discussing, Unresolved

interface ProcessedData {
  transcript: string;
  decisionsPerWeek: { week: string; count: number }[];
  conflictsTimeline: { time: string; count: number }[];
  taskStatus: { name: string; value: number }[];
  statusSnapshot: { name: string; value: number }[];
  isHydrating?: boolean;
  enrichedRows?: any[];
}

interface SpeakerStat {
  name: string;
  count: number;
}

interface SummaryState {
  p1: string;
  p2: string;
  p3: string;
  urgency: string[];
  risks: { level: string; description: string }[];
  speakers: {
    mostMessages: SpeakerStat[];
    mostQuestions: SpeakerStat[];
    mostDecisions: SpeakerStat[];
    mostTasks: SpeakerStat[];
  } | null;
  deadlines: { task: string; targetDate: string; status: string }[];
}

export default function Dashboard() {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processCsvData = (results: Papa.ParseResult<any>): ProcessedData => {
    let fullTranscript = '';
    const decisionsMap: Record<string, number> = {};
    const conflictsMap: Record<string, number> = {};
    const statusCounts = { Pending: 0, 'In Progress': 0, Completed: 0 };
    const snapshotCounts = { Decided: 0, Discussing: 0, Unresolved: 0 };

    // Check if the CSV actually contains the structured columns
    let hasStructuredColumns = false;
    if (results.data.length > 0) {
      const firstRow = results.data[0];
      if (firstRow['Resolution Status'] || firstRow['Decision Count'] || firstRow['Task Status']) {
        hasStructuredColumns = true;
      }
    }

    results.data.forEach((row: any) => {
      const rowText = Object.values(row).join(' ').toLowerCase(); 
      const transcriptText = row['Discussion Log / Transcript'] || row.Text || row.Transcript || row.Message || rowText;
      const speaker = row['Speaker/Source'] || row.Speaker || '';
      
      if (transcriptText.trim()) {
        fullTranscript += `${speaker ? speaker + ':' : ''} ${transcriptText}\n`;
      }

      if (!hasStructuredColumns) return; // Skip counting if unstructured, let Gemini handle it

      const dateStr = row['Timestamp/Date'] || row.Date || row.Timestamp || row.Time || 'Unknown';
      const timeLabel = dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;

      const resStatus = (row['Resolution Status'] || '').toLowerCase();
      if (resStatus.includes('decid') || (!resStatus && (rowText.includes('decid') || rowText.includes('approv')))) {
        snapshotCounts.Decided++;
      } else if (resStatus.includes('discuss') || (!resStatus && (rowText.includes('discuss') || rowText.includes('review')))) {
        snapshotCounts.Discussing++;
      } else if (resStatus.includes('unresolv') || (!resStatus && (rowText.includes('unresolv') || rowText.includes('conflict') || rowText.includes('issue')))) {
        snapshotCounts.Unresolved++;
      }

      const isDecision = row['Decision Count'] === '1' || row.Type === 'Decision' || (!row['Decision Count'] && rowText.includes('decid'));
      if (isDecision) {
        decisionsMap[timeLabel] = (decisionsMap[timeLabel] || 0) + 1;
      }
      
      const isConflict = row['Conflict/Contradiction Detected'] === '1' || row.Type === 'Conflict' || (!row['Conflict/Contradiction Detected'] && (rowText.includes('conflict') || rowText.includes('contradict')));
      if (isConflict) {
        conflictsMap[timeLabel] = (conflictsMap[timeLabel] || 0) + 1;
      }

      const taskStatus = (row['Task Status'] || row.Status || '').toLowerCase();
      if (taskStatus.includes('pending') || (!taskStatus && rowText.includes('pending'))) {
        statusCounts.Pending++;
      } else if (taskStatus.includes('progress') || (!taskStatus && rowText.includes('progress'))) {
        statusCounts['In Progress']++;
      } else if (taskStatus.includes('complet') || (!taskStatus && rowText.includes('complet'))) {
        statusCounts.Completed++;
      }
    });

    return { 
      transcript: fullTranscript || "No readable transcript found.", 
      decisionsPerWeek: Object.keys(decisionsMap).map(week => ({ week, count: decisionsMap[week] })), 
      conflictsTimeline: Object.keys(conflictsMap).map(time => ({ time, count: conflictsMap[time] })), 
      taskStatus: [
        { name: 'Pending', value: statusCounts.Pending },
        { name: 'In Progress', value: statusCounts['In Progress'] },
        { name: 'Completed', value: statusCounts.Completed }
      ],
      statusSnapshot: [
        { name: 'Decided', value: snapshotCounts.Decided },
        { name: 'Discussing', value: snapshotCounts.Discussing },
        { name: 'Unresolved', value: snapshotCounts.Unresolved }
      ],
      isHydrating: !hasStructuredColumns
    };
  };

  const processTextHeuristics = (text: string): ProcessedData => {
    return {
      transcript: text,
      decisionsPerWeek: [], conflictsTimeline: [],
      taskStatus: [{name:'Pending',value:0},{name:'In Progress',value:0},{name:'Completed',value:0}], 
      statusSnapshot: [{name:'Decided',value:0},{name:'Discussing',value:0},{name:'Unresolved',value:0}],
      isHydrating: true
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await processCsvData(results);
        }
      });
    }
  };

  const exportForLooker = () => {
    if (!data || !data.enrichedRows?.length) return;
    
    // Create CSV content from enriched rows
    const headers = ["Date", "Decision Count", "Conflict Detected", "Resolution Status", "Task Status"];
    const csvContent = [
      headers.join(","),
      ...data.enrichedRows.map(row => 
        `${row.date},${row.decisionCount},${row.conflictDetected},"${row.resolutionStatus}","${row.taskStatus}"`
      )
    ].join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "looker_analytics_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    const processAndSetData = async (processedData: ProcessedData) => {
      setData(processedData);
      setChatMessages([{ role: 'system', content: `Successfully analyzed ${file.name}. How can I help you explore this data?` }]);
      
      setSummaryLoading(true);
      setLoading(false); 
      
      try {
        const res = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: processedData.transcript })
        });
        
        const summaryData = await res.json();
        if (res.ok && summaryData.summary) {
          try {
            let rawJson = summaryData.summary.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsedSummary = JSON.parse(rawJson);
            
            let urgencyList: string[] = [];
            if (parsedSummary.urgencyBreakdown) {
               urgencyList.push(`🔴 Urgent: ${parsedSummary.urgencyBreakdown.urgent || "None"}`);
               urgencyList.push(`🟡 Follow-up: ${parsedSummary.urgencyBreakdown.followUp || "None"}`);
               urgencyList.push(`🟢 FYI: ${parsedSummary.urgencyBreakdown.fyi || "None"}`);
            }

            setSummary({
              p1: parsedSummary.keyThemes || "Key themes generated.",
              p2: parsedSummary.operationalFriction || "Operational friction generated.",
              p3: parsedSummary.nextSteps || "Next steps generated.",
              urgency: urgencyList,
              risks: parsedSummary.riskAssessment || [],
              speakers: parsedSummary.speakerAnalytics || null,
              deadlines: parsedSummary.deadlines || []
            });

            // HYBRID ANALYTICAL EXTRACTION: Hydrate charts if file was unstructured or needs AI classification
            if (parsedSummary.enrichedRows) {
              const decisionsMap: Record<string, number> = {};
              const conflictsMap: Record<string, number> = {};
              const statusCounts = { Pending: 0, 'In Progress': 0, Completed: 0 };
              const snapshotCounts = { Decided: 0, Discussing: 0, Unresolved: 0 };

              parsedSummary.enrichedRows.forEach((row: any) => {
                const timeLabel = row.date || 'Unknown';
                
                if (row.decisionCount > 0) decisionsMap[timeLabel] = (decisionsMap[timeLabel] || 0) + 1;
                if (row.conflictDetected > 0) conflictsMap[timeLabel] = (conflictsMap[timeLabel] || 0) + 1;
                
                const task = (row.taskStatus || '').toLowerCase();
                if (task.includes('pending')) statusCounts.Pending++;
                if (task.includes('progress')) statusCounts['In Progress']++;
                if (task.includes('complet')) statusCounts.Completed++;

                const res = (row.resolutionStatus || '').toLowerCase();
                if (res.includes('decid')) snapshotCounts.Decided++;
                if (res.includes('discuss')) snapshotCounts.Discussing++;
                if (res.includes('unresolv')) snapshotCounts.Unresolved++;
              });

              setData(prev => prev ? {
                ...prev,
                enrichedRows: parsedSummary.enrichedRows,
                decisionsPerWeek: Object.keys(decisionsMap).map(week => ({ week, count: decisionsMap[week] })),
                conflictsTimeline: Object.keys(conflictsMap).map(time => ({ time, count: conflictsMap[time] })),
                taskStatus: [
                  { name: 'Pending', value: statusCounts.Pending },
                  { name: 'In Progress', value: statusCounts['In Progress'] },
                  { name: 'Completed', value: statusCounts.Completed }
                ],
                statusSnapshot: [
                  { name: 'Decided', value: snapshotCounts.Decided },
                  { name: 'Discussing', value: snapshotCounts.Discussing },
                  { name: 'Unresolved', value: snapshotCounts.Unresolved }
                ],
                isHydrating: false
              } : null);
            }

          } catch (parseError) {
             console.error("Failed to parse JSON summary:", parseError);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSummaryLoading(false);
        setData(prev => prev ? { ...prev, isHydrating: false } : null); // Clear hydrating flag regardless
      }
    };

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processAndSetData(processCsvData(results)),
        error: (error) => { console.error(error); setLoading(false); }
      });
    } else {
      const text = await file.text();
      processAndSetData(processTextHeuristics(text));
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !data?.transcript) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: data.transcript, 
          question: question,
          history: chatMessages.filter(m => m.role !== 'system')
        }),
      });
      
      const responseData = await res.json();
      if (res.ok && responseData.response) {
        setChatMessages(prev => [...prev, { role: 'model', content: responseData.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'system', content: 'Analyzer encountered an error.' }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'system', content: 'Connection to Analyzer failed.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const renderMicroBars = (stats: SpeakerStat[] = [], color: string) => {
    if (!stats || stats.length === 0) return <span className="text-muted-foreground text-xs italic">No data</span>;
    const max = Math.max(...stats.map(s => s.count));
    return (
      <div className="space-y-2 mt-2">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-16 truncate text-muted-foreground">{stat.name}</span>
            <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000" 
                style={{ width: `${(stat.count / max) * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-6 text-right font-medium text-white">{stat.count}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <Activity className="w-10 h-10 text-primary mb-4" />
          <span className="text-muted-foreground font-medium tracking-wide uppercase text-sm">Parsing Document Locally...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">ClarityDesk</h1>
          <p className="text-muted-foreground mt-1 text-sm">A Data Intelligence Tool for Instant Meeting Clarity</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <input type="file" ref={fileInputRef} accept=".csv,.txt,.md,.pdf" className="hidden" onChange={handleFileChange} />
          <div className="flex items-center gap-4">
              {data && (
                <button 
                  onClick={exportForLooker}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export for Looker
                </button>
              )}
              <button onClick={handleUploadClick} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 shadow-lg shadow-primary/20">
                <UploadCloud className="w-5 h-5" />
                <span>Upload Document</span>
              </button>
            </div>
        </div>
      </div>

      {!data ? (
        <div onClick={handleUploadClick} className="mt-12 glass-panel border-dashed border-2 border-primary/30 hover:border-primary/60 rounded-3xl p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-primary/5 group">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Initialize Data Analyzer</h2>
          <p className="text-muted-foreground max-w-md">Upload your project exports to automatically generate PM analytics, risk assessments, and intelligent timeline tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          <div className="xl:col-span-3 space-y-8">
            
            {/* TOP COMPONENT: Summary & Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Executive Summary */}
              <section className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Minutes of Meeting
                </h2>
                {summaryLoading ? (
                  <div className="flex gap-3 text-muted-foreground animate-pulse py-8">
                    <Activity className="w-5 h-5 text-primary" /> 
                    <span>Generating structural analysis via Vercel Route...</span>
                  </div>
                ) : summary ? (
                  <div className="space-y-6">
                    <div className="prose prose-invert max-w-none text-muted-foreground text-[14px]">
                      <p className="mb-3"><strong className="text-white/80">Key Themes:</strong> {summary.p1}</p>
                      <p className="mb-3"><strong className="text-white/80">Operational Friction:</strong> {summary.p2}</p>
                      <p className="mb-3"><strong className="text-white/80">Next Steps:</strong> {summary.p3}</p>
                    </div>
                    {/* Urgency */}
                    <div className="bg-background/50 border border-border/50 rounded-xl p-4">
                      <h3 className="text-xs font-bold tracking-wider uppercase text-white mb-3">Urgency Breakdown</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {summary.urgency.map((item, idx) => {
                          const color = item.includes('🔴') ? 'text-red-400' : item.includes('🟡') ? 'text-yellow-400' : 'text-green-400';
                          return (
                            <div key={idx} className="flex gap-2 bg-card/40 p-2.5 rounded-lg border border-border/30 text-xs">
                              <span className={color}>{item.substring(0, 2)}</span>
                              <span className="text-muted-foreground">{item.substring(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* Automated Risk Detection */}
              <section className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" /> AI Risk Assessment
                </h2>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {summaryLoading ? (
                    <span className="text-muted-foreground text-sm animate-pulse">Scanning context for anomalies...</span>
                  ) : summary?.risks?.length ? (
                    summary.risks.map((risk, i) => {
                      const isHigh = risk.level.toLowerCase() === 'high';
                      const isMed = risk.level.toLowerCase() === 'medium';
                      const colorClass = isHigh ? 'border-red-500/30 bg-red-500/10 text-red-300' 
                                       : isMed ? 'border-orange-500/30 bg-orange-500/10 text-orange-300' 
                                       : 'border-green-500/30 bg-green-500/10 text-green-300';
                      const indicatorClass = isHigh ? 'bg-red-500' : isMed ? 'bg-orange-500' : 'bg-green-500';
                      
                      return (
                        <div key={i} className={`p-3 rounded-lg border ${colorClass} relative overflow-hidden`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorClass}`}></div>
                          <div className="pl-2">
                            <span className="uppercase text-[10px] font-bold tracking-wider mb-1 block opacity-80">{risk.level} Risk</span>
                            <p className="text-xs leading-snug">{risk.description}</p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <span className="text-muted-foreground text-sm italic">No significant risks detected.</span>
                  )}
                </div>
              </section>
            </div>

            {/* MIDDLE COMPONENT: 4-Charts & Speaker Analytics */}
            <section>
              <h2 className="text-xl font-bold text-white mb-6 flex items-center justify-between">
                <span>Metrics</span>
                {data.isHydrating && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse border border-primary/20">
                    AI Classifying Raw Rows...
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 4 Standard Charts */}
                <div className="glass-panel p-5 rounded-xl h-60 relative">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider"><HelpCircle className="w-3 h-3 inline mr-1 text-primary"/> Status</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 25 }}>
                      <Tooltip contentStyle={{ backgroundColor: '#1e1e2d', border: 'none', borderRadius: '8px', color: '#fff' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', bottom: 15 }} />
                      <Pie data={data.statusSnapshot} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={5} dataKey="value" nameKey="name">
                        {data.statusSnapshot.map((e, i) => <Cell key={i} fill={COLORS_STATUS[i % COLORS_STATUS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-panel p-5 rounded-xl h-60 relative">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3 inline mr-1 text-blue-400"/> Decisions</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.decisionsPerWeek} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <XAxis dataKey="week" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e1e2d', border: 'none', borderRadius: '8px', color: '#fff' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-panel p-5 rounded-xl h-60 relative">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider"><AlertTriangle className="w-3 h-3 inline mr-1 text-red-400"/> Conflicts</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.conflictsTimeline} margin={{ top: 10, right: 10, left: -25, bottom: 25 }}>
                      <XAxis dataKey="time" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1e2d', border: 'none', borderRadius: '8px', color: '#fff' }} />
                      <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-panel p-5 rounded-xl h-60 relative">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider"><Clock className="w-3 h-3 inline mr-1 text-yellow-400"/> Tasks</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 25 }}>
                      <Tooltip contentStyle={{ backgroundColor: '#1e1e2d', border: 'none', borderRadius: '8px', color: '#fff' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', bottom: 15 }} />
                      <Pie data={data.taskStatus} cx="50%" cy="50%" outerRadius={50} dataKey="value" nameKey="name">
                        {data.taskStatus.map((e, i) => <Cell key={i} fill={COLORS_TASK[i % COLORS_TASK.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* 4 Speaker Micro-Bars */}
                <div className="glass-panel p-5 rounded-xl">
                  <h3 className="text-xs font-medium text-white mb-2 uppercase flex justify-between"><User className="w-3 h-3"/> Messages</h3>
                  {summaryLoading ? <span className="text-xs text-muted-foreground">Calculating...</span> : renderMicroBars(summary?.speakers?.mostMessages, '#a855f7')}
                </div>
                <div className="glass-panel p-5 rounded-xl">
                  <h3 className="text-xs font-medium text-white mb-2 uppercase flex justify-between"><HelpCircle className="w-3 h-3"/> Questions</h3>
                  {summaryLoading ? <span className="text-xs text-muted-foreground">Calculating...</span> : renderMicroBars(summary?.speakers?.mostQuestions, '#3b82f6')}
                </div>
                <div className="glass-panel p-5 rounded-xl">
                  <h3 className="text-xs font-medium text-white mb-2 uppercase flex justify-between"><CheckCircle2 className="w-3 h-3"/> Decisions</h3>
                  {summaryLoading ? <span className="text-xs text-muted-foreground">Calculating...</span> : renderMicroBars(summary?.speakers?.mostDecisions, '#22c55e')}
                </div>
                <div className="glass-panel p-5 rounded-xl">
                  <h3 className="text-xs font-medium text-white mb-2 uppercase flex justify-between"><Activity className="w-3 h-3"/> Assignments</h3>
                  {summaryLoading ? <span className="text-xs text-muted-foreground">Calculating...</span> : renderMicroBars(summary?.speakers?.mostTasks, '#eab308')}
                </div>
              </div>
            </section>

            {/* BOTTOM COMPONENT: Smart Deadline Tracker */}
            <section className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" /> Deadlines & Milestones Tracker
              </h2>
              <div className="space-y-3">
                {summaryLoading ? (
                  <span className="text-muted-foreground text-sm animate-pulse">Inferring relative dates from context...</span>
                ) : summary?.deadlines?.length ? (
                  summary.deadlines.map((item, i) => {
                    const target = new Date(item.targetDate);
                    const now = new Date();
                    now.setHours(0,0,0,0);
                    
                    const isOverdue = item.status.toLowerCase() !== 'completed' && target < now;
                    
                    return (
                      <div key={i} className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border ${isOverdue ? 'bg-red-500/10 border-red-500/40' : 'bg-background/40 border-border/40'} transition-colors`}>
                        <div className="flex-1 pr-4">
                          <p className={`text-sm font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>{item.task}</p>
                        </div>
                        <div className="flex items-center gap-4 mt-3 md:mt-0">
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isOverdue ? 'bg-red-500/20 text-red-300' : 'bg-card text-muted-foreground'}`}>
                            {item.targetDate}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${item.status.toLowerCase() === 'completed' ? 'border-green-500/40 text-green-400' : 'border-border text-foreground'}`}>
                            {item.status}
                          </div>
                          {isOverdue && (
                            <span className="uppercase text-[10px] font-black tracking-widest text-red-500 animate-pulse bg-red-500/20 px-2 py-1 rounded">OVERDUE</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm bg-background/20 rounded-xl border border-border/20 border-dashed">
                    No strict deadlines or milestones detected in the uploaded file.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* SIDEBAR: Chatbot */}
          <div className="xl:col-span-1">
            <section className="glass-panel rounded-xl shadow-xl flex flex-col h-[800px] border-t-4 border-t-primary sticky top-6">
              <div className="p-4 border-b border-border bg-card/50">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  ClarityDesk Assistant Chatbot
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-2xl p-3.5 text-[13.5px] leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-md shadow-primary/20' 
                        : 'bg-card/80 border border-border/50 text-foreground rounded-tl-sm shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-card/80 border border-border/50 rounded-2xl p-4 rounded-tl-sm flex gap-1.5 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce delay-150"></div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-card/50 border-t border-border/50">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a quick question..." 
                    className="flex-1 bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70" 
                    disabled={chatLoading}
                  />
                  <button 
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-primary hover:bg-primary/90 text-white p-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-md flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </section>
          </div>

        </div>
      )}
    </div>
  );
}
