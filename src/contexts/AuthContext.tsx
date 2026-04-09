import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type UserRole = 'student' | 'professor' | null;

interface StudentData {
  student_id: string;
  first_name: string;
  last_name: string;
  dept: string;
  year: number;
  program: string;
  email: string;
}

interface ProfData {
  prof_id: string;
  name: string;
  dept_code: string;
  email: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole;
  studentData: StudentData | null;
  profData: ProfData | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  studentData: null,
  profData: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [profData, setProfData] = useState<ProfData | null>(null);
  const [loading, setLoading] = useState(true);

  const detectRole = async (email: string) => {
    // 1. Sanitize the email from Google
    const cleanEmail = email.trim().toLowerCase();
    console.log("🔍 AuthContext: Searching for email ->", cleanEmail);

    try {
      // 2. Check students table (Using ilike for case-insensitive match)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (studentError) {
        console.error("❌ AuthContext: Student query error:", studentError);
      }

      if (student) {
        console.log("✅ AuthContext: Found Student Record:", student);
        setRole('student');
        setStudentData(student);
        setProfData(null);
        return;
      }

      // 3. Check profs table
      const { data: prof, error: profError } = await supabase
        .from('profs')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (profError) {
        console.error("❌ AuthContext: Professor query error:", profError);
      }

      if (prof) {
        console.log("✅ AuthContext: Found Professor Record:", prof);
        setRole('professor');
        setProfData(prof);
        setStudentData(null);
        return;
      }

      // 4. No record found
      console.warn("⚠️ AuthContext: Email not found in either table.");
      setRole(null);
      setStudentData(null);
      setProfData(null);

    } catch (err) {
      console.error("🔥 AuthContext: Critical failure during detectRole:", err);
      setRole(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user?.email) {
          await detectRole(session.user.email);
        } else {
          setRole(null);
          setStudentData(null);
          setProfData(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        await detectRole(session.user.email);
      } 
      setLoading(false); 
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setStudentData(null);
    setProfData(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, studentData, profData, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
