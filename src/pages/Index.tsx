import { useAuth } from '@/contexts/AuthContext';
import LoginPage from './LoginPage';
import StudentDashboard from './StudentDashboard';
import ProfessorDashboard from './ProfessorDashboard';
import DashboardSkeleton from '@/components/DashboardSkeleton';

const Index = () => {
  const { session, role, loading } = useAuth();

  // 1. If we are still checking the session or the role, stay on the skeleton
  if (loading) {
    return <DashboardSkeleton />;
  }

  // 2. If no one is logged in, show the login page
  if (!session) {
    return <LoginPage />;
  }

  // 3. Route based on the role found in the database
  // Note: Matching 'student' and 'students' just in case
  if (role === 'student' || role === 'students') {
    return <StudentDashboard />;
  }

  if (role === 'professor' || role === 'professor' || role === 'profs') {
    return <ProfessorDashboard />;
  }

  // 4. Fallback: If session exists but role is still null after loading is done
  // This usually means the email search in AuthContext actually failed.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-bold text-foreground">Account Not Found</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Logged in as: <span className="font-mono text-primary">{session.user.email}</span>
          <br /><br />
          Your email is not registered in the IIT Dharwad system. 
          Please contact the admin to add your record to the students table.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

export default Index;
