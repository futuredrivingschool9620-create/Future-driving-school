import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import AppRouter from './router';
import './index.css';

export default function App() {
  return (
    <ErrorBoundary autoRecover>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
