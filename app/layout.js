import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata = { title: 'ChaloOnTour - Super Admin', description: 'ChaloOnTour Super Admin Dashboard' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
