import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, BookOpen, Users, UserPlus, ChevronDown, ChevronUp, CheckCircle2, XCircle, Search, ArrowUpDown, Loader2 } from 'lucide-react';
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
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceRecord[]>>({});

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

    // Get enrolled students
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

    // Get total classes for this course
    const { data: allSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', course.course_code);

    const uniqueDates = new Set(allSessions?.map(s => s.session_date) || []);
    const totalClasses = uniqueDates.size;

    // Get attendance per student
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

  const toggleStudentDetail = async (studentId: string) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
      return;
    }
    setExpandedStudent(studentId);

    if (studentAttendance[studentId]) return;

    // Fetch date-wise attendance
    const { data: allSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', selectedCourse!.course_code);

    const allDates = [...new Set(allSessions?.map(s => s.session_date) || [])].sort();

    const { data: presentSessions } = await supabase
      .from('attendance')
      .select('session_date')
      .eq('course_code', selectedCourse!.course_code)
      .eq('student_id', studentId);

    const presentDates = new Set(presentSessions?.map(s => s.session_date) || []);

    setStudentAttendance(prev => ({
      ...prev,
      [studentId]: allDates.map(date => ({ date, present: presentDates.has(date) })),
    }));
  };

  const sortedStudents = [...students].sort((a, b) => {
    const pctA = a.total_classes > 0 ? a.attended / a.total_classes : 0;
    const pctB = b.total_classes > 0 ? b.attended / b.total_classes : 0;
    return sortAsc ? pctA - pctB : pctB - pctA;
  });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setEnrollError('');
    setEnrollSuccess('');
    if (query.length < 2) { setSearchResults([]); return; }

    setSearchLoading(true);
    const { data } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, dept, program, year')
      .or(`student_id.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(10);

    setSearchResults(data || []);
    setSearchLoading(false);
  };

  const enrollStudent = async (student: SearchStudent) => {
    if (!selectedCourse) return;
    setEnrolling(true);
    setEnrollError('');
    setEnrollSuccess('');

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('course_enrollments')
      .select('enrollment_id')
      .eq('student_id', student.student_id)
      .eq('course_code', selectedCourse.course_code)
      .maybeSingle();

    if (existing) {
      setEnrollError('Student already enrolled in this course.');
      setEnrolling(false);
      return;
    }

    const { error } = await supabase
      .from('course_enrollments')
      .insert({
        student_id: student.student_id,
        course_code: selectedCourse.course_code,
        status: 'active',
        enrolled_date: new Date().toISOString().split('T')[0],
      });

    if (error) {
      setEnrollError(error.message);
    } else {
      setEnrollSuccess(`${student.first_name} ${student.last_name} enrolled successfully!`);
      // Refresh roster
      openCourseDetail(selectedCourse);
      fetchCourses();
    }
    setEnrolling(false);
  };

  if (!profData) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70 uppercase tracking-wider">IIT Dharwad — Professor</p>
            <h1 className="text-xl font-bold">{profData.name}</h1>
            <p className="text-sm opacity-80">{profData.prof_id} · {profData.dept_code}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {!selectedCourse ? (
          <>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">My Courses</h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ) : courses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No courses assigned.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map(course => (
                  <Card
                    key={course.course_code}
                    className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
                    onClick={() => openCourseDetail(course)}
                  >
                    <CardHeader className="pb-2">
                      <p className="text-xs font-mono text-accent">{course.course_code}</p>
                      <CardTitle className="text-base">{course.course_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {course.enrolled_count} students
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCourse(null)} className="mb-1">
                  ← Back to Courses
                </Button>
                <h2 className="text-lg font-semibold">
                  <span className="text-accent font-mono text-sm">{selectedCourse.course_code}</span>{' '}
                  {selectedCourse.course_name}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSortAsc(!sortAsc)}>
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Sort {sortAsc ? '↑' : '↓'}
                </Button>
                <Button size="sm" onClick={() => { setEnrollOpen(true); setSearchQuery(''); setSearchResults([]); setEnrollError(''); setEnrollSuccess(''); }}>
                  <UserPlus className="w-4 h-4 mr-1" /> Enroll Student
                </Button>
              </div>
            </div>

            {rosterLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : students.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No students enrolled yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {sortedStudents.map(s => {
                  const pct = s.total_classes > 0 ? (s.attended / s.total_classes) * 100 : 0;
                  const pct = Math.min(Math.round(rawPct), 100);
                  return (
                    <Card key={s.student_id} className="border-border/50">
                      <div
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleStudentDetail(s.student_id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.student_id} · {s.dept} · {s.program}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <AttendanceRing percentage={pct} size={44} strokeWidth={4} />
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <CardContent className="pt-0 pb-3 px-4">
                          <div className="border-t pt-2 space-y-1">
                            {!studentAttendance[s.student_id] ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                              </div>
                            ) : studentAttendance[s.student_id].length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">No classes held yet.</p>
                            ) : (
                              studentAttendance[s.student_id].map(r => (
                                <div key={r.date} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30">
                                  <span className="text-xs">
                                    {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </span>
                                  {r.present ? (
                                    <span className="flex items-center gap-1 text-success text-xs font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Present
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                                      <XCircle className="w-3.5 h-3.5" /> Absent
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Enroll Student Modal */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by student ID or name..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {enrollError && <p className="text-sm text-destructive font-medium">{enrollError}</p>}
            {enrollSuccess && <p className="text-sm text-success font-medium">{enrollSuccess}</p>}

            {searchLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map(s => (
                  <div key={s.student_id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.student_id} · {s.dept} · {s.program} · Year {s.year}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => enrollStudent(s)} disabled={enrolling}>
                      {enrolling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enroll'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Student not found.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfessorDashboard;
