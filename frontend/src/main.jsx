import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { DeviceProfileProvider } from './providers/DeviceProfileProvider.jsx';
import './styles/legacy.css';
import './styles/app.css';
import './styles/tailwind.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <DeviceProfileProvider>
      <App />
    </DeviceProfileProvider>
  </AppErrorBoundary>
);
