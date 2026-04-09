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
    const cleanEmail = email.trim().toLowerCase();
    console.log("🔍 AuthContext: Searching for email ->", cleanEmail);

    try {
      // Safety Timeout: 5 seconds to prevent infinite skeleton if DB hangs
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 5000)
      );

      // Check students table
      const studentPromise = supabase
        .from('students')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      const { data: student, error: studentError } = await Promise.race([studentPromise, timeout]) as any;

      if (student) {
        console.log("✅ AuthContext: Found Student Record");
        setRole('student');
        setStudentData(student);
        setProfData(null);
        return;
      }

      // Check profs table
      const { data: prof } = await supabase
        .from('profs')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (prof) {
        console.log("✅ AuthContext: Found Professor Record");
        setRole('professor');
        setProfData(prof);
        setStudentData(null);
        return;
      }

      console.warn("⚠️ AuthContext: Email not in database.");
      setRole(null);
    } catch (err) {
      console.error("🔥 AuthContext Error:", err);
    } finally {
      // CRITICAL: Always release the loading screen
      console.log("🔓 AuthContext: Loading complete.");
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Listen for auth changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("🔄 Auth Event:", event);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user?.email) {
          await detectRole(currentSession.user.email);
        } else {
          setRole(null);
          setStudentData(null);
          setProfData(null);
          setLoading(false);
        }
      }
    );

    // 2. Initial Session Check (Handle page refresh)
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (initialSession?.user?.email) {
        setSession(initialSession);
        setUser(initialSession.user);
        await detectRole(initialSession.user.email);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRole(null);
      setStudentData(null);
      setProfData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, role, studentData, profData, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
