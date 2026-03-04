import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client'
import "./index.css";
import App from './components/App.jsx'
import { HashRouter as Router } from "react-router-dom"
import { AuthProvider } from './Auth.jsx';

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
	<QueryClientProvider client={queryClient}>
		<Router>
			<AuthProvider>
				<App />
			</AuthProvider>
		</Router>
	</QueryClientProvider>
)
