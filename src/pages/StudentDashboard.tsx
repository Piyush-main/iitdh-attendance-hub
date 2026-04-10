import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, BookOpen, Calendar, CheckCircle2, XCircle, GraduationCap, Clock } from 'lucide-react';
import AttendanceRing from '@/components/AttendanceRing';

interface Course {
  course_code: string;
  course_name: string;
  prof_name: string;
  total_classes: number;
  attended: number;
}

interface AttendanceRecord {
  date: string;
  present: boolean;
}

const StudentDashboard = () => {
  const { studentData, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [attendanceDetail, setAttendanceDetail] = useState<AttendanceRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!studentData) return;
    fetchCourses();
  }, [studentData]);

  const fetchCourses = async () => {
    if (!studentData) return;
    setLoading(true);

    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select('course_code')
      .eq('student_id', studentData.student_id)
      .eq('status', 'active');

    if (!enrollments || enrollments.length === 0) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const courseCodes = enrollments.map(e => e.course_code);
    const { data: courseData } = await supabase
      .from('courses')
      .select('course_code, course_name, prof_id')
      .in('course_code', courseCodes);

    if (!courseData) { setLoading(false); return; }

    const profIds = [...new Set(courseData.map(c => c.prof_id))];
    const { data: profs } = await supabase
      .from('profs')
      .select('prof_id, name')
      .in('prof_id', profIds);

    const profMap = new Map(profs?.map(p => [p.prof_id, p.name]) || []);
    const courseResults: Course[] = [];

    for (const course of courseData) {
      const { data: sessions } = await supabase
        .from('attendance')
        .select('session_date')
        .eq('course_code', course.course_code);

      const uniqueDates = new Set(sessions?.map(s => s.session_date) || []);
      const totalClasses = uniqueDates.size;

      const { data: attended } = await supabase
        .from('attendance')
        .select('session_date')
        .eq('course_code', course.course_code)
        .eq('student_id', studentData.student_id);

      courseResults.push({
        course_code: course.course_code,
        course_name: course.course_name,
        prof_name: profMap.get(course.prof_id) || 'Unknown Professor',
        total_classes: totalClasses,
        attended: attended?.length || 0,
      });
    }

    setCourses(courseResults);
    setLoading(false);
  };

  const openDetail = async (course: Course) => {
    setSelectedCourse(course);
    setDetailLoading(true);

    const { data: allSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', course.course_code);

    const allDates = [...new Set(allSessions?.map(s => s.session_date) || [])].sort();

    const { data: presentSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', course.course_code)
      .eq('student_id', studentData!.student_id);

    const presentDates = new Set(presentSessions?.map(s => s.session_date) || []);

    setAttendanceDetail(allDates.map(date => ({
      date,
      present: presentDates.has(date),
    })));
    setDetailLoading(false);
  };

  if (!studentData) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] relative overflow-hidden">
      
      {/* Background Watermark */}
      <div className="fixed -bottom-24 -left-24 opacity-[0.03] pointer-events-none -rotate-12">
        <GraduationCap size={600} />
      </div>

      <header className="bg-gradient-to-r from-[#0f172a] to-[#334155] text-white px-4 sm:px-8 py-10 shadow-2xl relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 skew-x-[-20deg] translate-x-32" />
        <div className="max-w-6xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
              <GraduationCap className="text-white w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold">IIT Dharwad • Student Portal</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {studentData.first_name} {studentData.last_name}
              </h1>
              <p className="text-sm opacity-80 font-mono tracking-tighter">
                {studentData.student_id} • {studentData.dept} • {studentData.program}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-white hover:bg-white/10 border border-white/20 px-4 rounded-xl transition-all">
            <LogOut className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">My Enrolled Courses</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl shadow-sm" />)}
          </div>
        ) : courses.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent">
            <CardContent className="py-20 text-center">
              <BookOpen className="w-16 h-16 mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-medium">You haven't been enrolled in any courses yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => {
              const rawPct = course.total_classes > 0 ? (course.attended / course.total_classes) * 100 : 0;
              const pct = Math.min(Math.round(rawPct), 100);
              return (
                <Card
                  key={course.course_code}
                  className="group cursor-pointer bg-white/80 backdrop-blur-md border border-white shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 rounded-3xl overflow-hidden"
                  onClick={() => openDetail(course)}
                >
                  <div className={`h-1.5 w-full ${pct < 75 ? 'bg-destructive/40' : 'bg-success/40'} group-hover:opacity-100 transition-opacity`} />
                  <CardHeader className="pb-2">
                    <p className="text-[10px] font-black font-mono text-primary/50 tracking-widest uppercase">{course.course_code}</p>
                    <CardTitle className="text-lg font-extrabold text-slate-800 line-clamp-1">{course.course_name}</CardTitle>
                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> {course.prof_name}
                    </p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Attendance</p>
                      <p className="text-xl font-black text-slate-700">
                        {course.attended}<span className="text-slate-300 mx-1">/</span>{course.total_classes}
                      </p>
                    </div>
                    <div className="relative">
                      <AttendanceRing percentage={pct} size={54} strokeWidth={6} />
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-600">
                        {pct}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <DialogHeader className="relative z-10">
              <p className="text-[10px] font-black text-primary tracking-[0.3em] uppercase mb-2">{selectedCourse?.course_code}</p>
              <DialogTitle className="text-2xl font-black leading-tight">
                {selectedCourse?.course_name}
              </DialogTitle>
              <p className="text-slate-400 text-sm mt-1">{selectedCourse?.prof_name}</p>
            </DialogHeader>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto bg-white">
            {detailLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : attendanceDetail.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-slate-100 mb-4" />
                <p className="text-slate-400 text-sm italic tracking-tight">No attendance records found yet.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {attendanceDetail.map(record => (
                  <div
                    key={record.date}
                    className="flex items-center justify-between py-3.5 px-5 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">
                        {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        {new Date(record.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {record.present ? (
                      <div className="bg-success/10 px-4 py-1.5 rounded-full flex items-center gap-2 border border-success/20">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="text-[10px] font-black text-success uppercase tracking-widest">Present</span>
                      </div>
                    ) : (
                      <div className="bg-destructive/10 px-4 py-1.5 rounded-full flex items-center gap-2 border border-destructive/20">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-[10px] font-black text-destructive uppercase tracking-widest">Absent</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
            <Button variant="ghost" className="text-slate-400 text-xs font-bold uppercase tracking-widest" onClick={() => setSelectedCourse(null)}>
              Close Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;
