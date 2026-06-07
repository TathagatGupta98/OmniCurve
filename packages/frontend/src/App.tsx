import { ConnectButton } from '@rainbow-me/rainbowkit';
import MarketDetailsPage from './components/MarketDetailsPage';

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 font-sans">
      <header className="border-b border-zinc-800 p-4 flex justify-between items-center">
        <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          OmniCurve
        </div>
        <div>
          <ConnectButton />
        </div>
      </header>
      <main className="w-full px-4 md:px-8">
        <MarketDetailsPage />
      </main>
    </div>
  );
}

export default App;
