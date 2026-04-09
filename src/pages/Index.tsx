import { useAuth } from '@/contexts/AuthContext';
import LoginPage from './LoginPage';
import StudentDashboard from './StudentDashboard';
import ProfessorDashboard from './ProfessorDashboard';
import DashboardSkeleton from '@/components/DashboardSkeleton';

const Index = () => {
  const { session, role, loading } = useAuth();

  if (loading) return <DashboardSkeleton />;
  if (!session) return <LoginPage />;

  if (role === 'students') return <StudentDashboard />;
  if (role === 'profs') return <ProfessorDashboard />;

  // User authenticated but not found in students or profs tables
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-bold text-foreground">Account Not Found</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Your email is not registered as a student or professor. Please contact the administration.
        </p>
      </div>
    </div>
  );
};

export default Index;
