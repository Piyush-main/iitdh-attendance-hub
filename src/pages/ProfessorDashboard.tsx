import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, BookOpen, Users, UserPlus, ChevronDown, ChevronUp, CheckCircle2, XCircle, Search, Loader2, GraduationCap } from 'lucide-react';
import AttendanceRing from '@/components/AttendanceRing';

interface Course {
  course_code: string;
  course_name: string;
  enrolled_count: number;
}

interface StudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
  dept: string;
  program: string;
  year: number;
  attended: number;
  total_classes: number;
}

interface AttendanceRecord {
  date: string;
  present: boolean;
}

interface SearchStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  dept: string;
  program: string;
  year: number;
}

const ProfessorDashboard = () => {
  const { profData, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceRecord[]>>({});
  const [rosterSearch, setRosterSearch] = useState('');

  // Enroll modal
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState('');

  useEffect(() => {
    if (!profData) return;
    fetchCourses();
  }, [profData]);

  const fetchCourses = async () => {
    if (!profData) return;
    setLoading(true);
    const { data: courseData } = await supabase
      .from('courses')
      .select('course_code, course_name')
      .eq('prof_id', profData.prof_id);
    if (!courseData) { setLoading(false); return; }
    const results: Course[] = [];
    for (const c of courseData) {
      const { count } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_code', c.course_code)
        .eq('status', 'active');
      results.push({ ...c, enrolled_count: count || 0 });
    }
    setCourses(results);
    setLoading(false);
  };

  const openCourseDetail = async (course: Course) => {
    setSelectedCourse(course);
    setRosterLoading(true);
    setExpandedStudent(null);
    setStudentAttendance({});
    setRosterSearch('');
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select('student_id')
      .eq('course_code', course.course_code)
      .eq('status', 'active');
    if (!enrollments || enrollments.length === 0) {
      setStudents([]);
      setRosterLoading(false);
      return;
    }
    const studentIds = enrollments.map(e => e.student_id);
    const { data: studentData } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, dept, program, year')
      .in('student_id', studentIds);
    const { data: allSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', course.course_code);
    const uniqueDates = new Set(allSessions?.map(s => s.session_date) || []);
    const totalClasses = uniqueDates.size;
    const rows: StudentRow[] = [];
    for (const s of (studentData || [])) {
      const { data: attended } = await supabase
        .from('attendance')
        .select('session_date')
        .eq('course_code', course.course_code)
        .eq('student_id', s.student_id);
      rows.push({ ...s, attended: attended?.length || 0, total_classes: totalClasses });
    }
    setStudents(rows);
    setRosterLoading(false);
  };

  const toggleAttendance = async (studentId: string, date: string, isPresent: boolean) => {
    if (!selectedCourse || !profData) return;
    try {
      if (isPresent) {
        await supabase.from('attendance').delete().eq('student_id', studentId).eq('course_code', selectedCourse.course_code).eq('session_date', date);
      } else {
        await supabase.from('attendance').insert({ student_id: studentId, course_code: selectedCourse.course_code, session_date: date, authorized_by: profData.prof_id });
      }
      setStudentAttendance(prev => {
        const currentLogs = prev[studentId] || [];
        return { ...prev, [studentId]: currentLogs.map(log => log.date === date ? { ...log, present: !isPresent } : log) };
      });
      setStudents(prev => prev.map(s => {
        if (s.student_id === studentId) { return { ...s, attended: isPresent ? Math.max(0, s.attended - 1) : s.attended + 1 }; }
        return s;
      }));
    } catch (err) {
      console.error("❌ Toggle failed:", err);
    }
  };

  const toggleStudentDetail = async (studentId: string) => {
    if (expandedStudent === studentId) { setExpandedStudent(null); return; }
    setExpandedStudent(studentId);
    if (studentAttendance[studentId]) return;
    const { data: allSessions } = await supabase.from('attendance').select('session_date').eq('course_code', selectedCourse!.course_code);
    const allDates = [...new Set(allSessions?.map(s => s.session_date) || [])].sort();
    const { data: presentSessions } = await supabase.from('attendance').select('session_date').eq('course_code', selectedCourse!.course_code).eq('student_id', studentId);
    const presentDates = new Set(presentSessions?.map(s => s.session_date) || []);
    setStudentAttendance(prev => ({ ...prev, [studentId]: allDates.map(date => ({ date, present: presentDates.has(date) })), }));
  };

  // Fixed: Filter and PERMANENT alphabetical sort
  const filteredAndSortedStudents = students
    .filter(s => 
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(rosterSearch.toLowerCase()) || 
      s.student_id.toLowerCase().includes(rosterSearch.toLowerCase())
    )
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setEnrollError('');
    setEnrollSuccess('');
    if (query.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase.from('students').select('student_id, first_name, last_name, dept, program, year').or(`student_id.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`).limit(10);
    setSearchResults(data || []);
    setSearchLoading(false);
  };

  const enrollStudent = async (student: SearchStudent) => {
    if (!selectedCourse) return;
    setEnrolling(true);
    const { data: existing } = await supabase.from('course_enrollments').select('enrollment_id').eq('student_id', student.student_id).eq('course_code', selectedCourse.course_code).maybeSingle();
    if (existing) { setEnrollError('Student already enrolled.'); setEnrolling(false); return; }
    const { error } = await supabase.from('course_enrollments').insert({ student_id: student.student_id, course_code: selectedCourse.course_code, status: 'active', enrolled_date: new Date().toISOString().split('T')[0], });
    if (error) { setEnrollError(error.message); } else { setEnrollSuccess(`${student.first_name} enrolled!`); openCourseDetail(selectedCourse); fetchCourses(); }
    setEnrolling(false);
  };

  if (!profData) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] relative overflow-hidden text-slate-900">
      
      {/* Background Watermark */}
      <div className="fixed -bottom-20 -right-20 opacity-[0.03] pointer-events-none rotate-12">
        <GraduationCap size={600} />
      </div>

      <header className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] text-white px-4 sm:px-8 py-10 shadow-2xl relative">
        <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-[-20deg] translate-x-32" />
        <div className="max-w-6xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm">
              <Users className="text-white w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold">IIT Dharwad • Professor Portal</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{profData.name}</h1>
              <p className="text-sm opacity-80 font-mono">{profData.prof_id} • {profData.dept_code}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-white hover:bg-white/10 border border-white/20 px-4">
            <LogOut className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 relative z-10">
        {!selectedCourse ? (
          <>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Assigned Courses</h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-2xl shadow-sm" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map(course => (
                  <Card 
                    key={course.course_code} 
                    className="group cursor-pointer bg-white/80 backdrop-blur-md border border-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden" 
                    onClick={() => openCourseDetail(course)}
                  >
                    <div className="h-2 w-full bg-primary/20 group-hover:bg-primary transition-colors" />
                    <CardHeader className="pb-4">
                      <p className="text-[10px] font-mono font-bold text-primary mb-1">{course.course_code}</p>
                      <CardTitle className="text-lg font-bold leading-tight text-slate-800">{course.course_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Users className="w-4 h-4" /> {course.enrolled_count} Students Enrolled
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCourse(null)} className="pl-0 hover:bg-transparent text-slate-500 hover:text-primary">
                  ← Back to Courses
                </Button>
                <h2 className="text-2xl font-black text-slate-800">
                  <span className="text-primary/40 font-mono text-lg mr-2">[{selectedCourse.course_code}]</span>
                  {selectedCourse.course_name}
                </h2>
              </div>
              <div className="flex gap-3">
                <Button size="sm" onClick={() => setEnrollOpen(true)} className="rounded-xl shadow-lg shadow-primary/20">
                  <UserPlus className="w-4 h-4 mr-2" /> Enroll Student
                </Button>
              </div>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search by name or student ID..." 
                className="pl-12 h-14 bg-white/80 backdrop-blur-sm border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-base"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
              />
            </div>

            <div className="grid gap-3">
              {filteredAndSortedStudents.map(s => {
                const rawPct = s.total_classes > 0 ? (s.attended / s.total_classes) * 100 : 0;
                const pct = Math.min(Math.round(rawPct), 100);
                const isExpanded = expandedStudent === s.student_id;
                
                return (
                  <Card key={s.student_id} className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-white/80 transition-colors" onClick={() => toggleStudentDetail(s.student_id)}>
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{s.first_name} {s.last_name}</p>
                          <p className="text-xs font-mono text-slate-400">{s.student_id} • {s.attended}/{s.total_classes} Classes Attended</p>
                        </div>
                      </div>
                      
                      {/* Fixed: Layout for Percentage and Ring to avoid blur/overlap */}
                      <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Attendance</p>
                          <p className={`text-lg font-black ${pct < 75 ? 'text-red-500' : 'text-emerald-600'}`}>{pct}%</p>
                        </div>
                        <div className="relative flex items-center justify-center w-[50px] h-[50px]">
                           <AttendanceRing percentage={pct} size={50} strokeWidth={5} />
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <CardContent className="pt-0 pb-6 px-6 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4 mt-5">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Attendance Logs • Tap to Toggle</p>
                          <div className="h-[1px] flex-1 bg-slate-200 ml-4" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {!studentAttendance[s.student_id] ? (
                            <div className="col-span-full flex items-center justify-center py-4 text-slate-400 gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Fetching history...</span>
                            </div>
                          ) : studentAttendance[s.student_id].length === 0 ? (
                            <p className="col-span-full text-xs text-slate-400 py-6 text-center italic border-2 border-dashed rounded-2xl">No recorded sessions for this course.</p>
                          ) : (
                            studentAttendance[s.student_id].map(r => (
                              <button 
                                key={r.date} 
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.97] shadow-sm ${r.present ? 'bg-white border-success/20 hover:border-success/50' : 'bg-white border-destructive/20 hover:border-destructive/50'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAttendance(s.student_id, r.date, r.present);
                                }}
                              >
                                <span className="text-[11px] font-bold text-slate-600">
                                  {new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })}
                                </span>
                                {r.present ? (
                                  <span className="text-success flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Present
                                  </span>
                                ) : (
                                  <span className="text-destructive flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                                    <XCircle className="w-3.5 h-3.5" /> Absent
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black">Enroll New Student</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Enter Student ID or Full Name..." value={searchQuery} onChange={e => handleSearch(e.target.value)} className="pl-11 h-12 rounded-xl bg-slate-50 border-slate-200" />
            </div>
            {enrollError && <p className="text-xs text-destructive font-bold bg-destructive/5 p-3 rounded-lg border border-destructive/10">{enrollError}</p>}
            {enrollSuccess && <p className="text-xs text-success font-bold bg-success/5 p-3 rounded-lg border border-success/10">{enrollSuccess}</p>}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {searchResults.map(s => (
                <div key={s.student_id} className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white transition-all shadow-sm">
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-slate-800">{s.first_name} {s.last_name}</p>
                    <p className="text-[10px] font-mono text-slate-400 tracking-wider">{s.student_id} • {s.dept}</p>
                  </div>
                  <Button size="sm" onClick={() => enrollStudent(s)} disabled={enrolling} className="rounded-xl h-9 px-4">
                    {enrolling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enroll'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfessorDashboard;
