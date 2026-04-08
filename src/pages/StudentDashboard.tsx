import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, BookOpen, Calendar, CheckCircle2, XCircle } from 'lucide-react';
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

    // Get enrolled courses
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

    // Get course details with prof info
    const { data: courseData } = await supabase
      .from('courses')
      .select('course_code, course_name, prof_id')
      .in('course_code', courseCodes);

    if (!courseData) { setLoading(false); return; }

    // Get prof names
    const profIds = [...new Set(courseData.map(c => c.prof_id))];
    const { data: profs } = await supabase
      .from('profs')
      .select('prof_id, name')
      .in('prof_id', profIds);

    const profMap = new Map(profs?.map(p => [p.prof_id, p.name]) || []);

    // Get attendance data for each course
    const courseResults: Course[] = [];

    for (const course of courseData) {
      // Total classes held (distinct session_dates)
      const { data: sessions } = await supabase
        .from('attendance')
        .select('session_date')
        .eq('course_code', course.course_code);

      const uniqueDates = new Set(sessions?.map(s => s.session_date) || []);
      const totalClasses = uniqueDates.size;

      // Classes attended by this student
      const { data: attended } = await supabase
        .from('attendance')
        .select('session_date')
        .eq('course_code', course.course_code)
        .eq('student_id', studentData.student_id);

      courseResults.push({
        course_code: course.course_code,
        course_name: course.course_name,
        prof_name: profMap.get(course.prof_id) || 'Unknown',
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

    // Get all session dates for this course
    const { data: allSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', course.course_code);

    const allDates = [...new Set(allSessions?.map(s => s.session_date) || [])].sort();

    // Get dates the student was present
    const { data: presentSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', course.course_code)
      .eq('student_id', studentData!.student_id);

    const presentDates = new Set(presentSessions?.map(s => s.session_date) || []);

    const records: AttendanceRecord[] = allDates.map(date => ({
      date,
      present: presentDates.has(date),
    }));

    setAttendanceDetail(records);
    setDetailLoading(false);
  };

  if (!studentData) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70 uppercase tracking-wider">IIT Dharwad — Student</p>
            <h1 className="text-xl font-bold">
              {studentData.first_name} {studentData.last_name}
            </h1>
            <p className="text-sm opacity-80">{studentData.student_id} · {studentData.dept} · {studentData.program}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">My Courses</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(course => {
              const pct = course.total_classes > 0 ? (course.attended / course.total_classes) * 100 : 0;
              return (
                <Card
                  key={course.course_code}
                  className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
                  onClick={() => openDetail(course)}
                >
                  <CardHeader className="pb-2">
                    <p className="text-xs font-mono text-accent">{course.course_code}</p>
                    <CardTitle className="text-base">{course.course_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{course.prof_name}</p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {course.attended}/{course.total_classes} classes
                    </div>
                    <AttendanceRing percentage={pct} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <span className="text-accent font-mono text-sm">{selectedCourse?.course_code}</span>
              <br />
              {selectedCourse?.course_name}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : attendanceDetail.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground text-sm">No classes held yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {attendanceDetail.map(record => (
                <div
                  key={record.date}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">
                    {new Date(record.date).toLocaleDateString('en-IN', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                  {record.present ? (
                    <span className="flex items-center gap-1 text-success text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Present
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive text-sm font-medium">
                      <XCircle className="w-4 h-4" /> Absent
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;
