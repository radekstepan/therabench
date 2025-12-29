import { X, Sparkles, BarChart3, Users, Database } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 border border-emerald-500/20 rounded-md max-w-2xl w-full mx-4 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600/10 to-blue-600/10 p-8 border-b border-emerald-500/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-emerald-500/20 p-2 rounded">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-light text-white">Welcome to TheraBench</h2>
          </div>
          <p className="text-zinc-400 text-sm">
            An evaluation platform for testing how well Language Models respond to therapeutic scenarios
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <Feature
              icon={<BarChart3 className="w-5 h-5" />}
              title="Model Evaluation"
              description="Synthetic therapeutic scenarios (CBT, DBT, ACT) are generated and used to evaluate how various LLMs and SLMs respond to patient situations."
            />
            
            <Feature
              icon={<Users className="w-5 h-5" />}
              title="Expert Review System"
              description="Human experts can override AI scores, rank answers, and add notes. All reviews are stored locally in your browser for privacy."
            />
            
            <Feature
              icon={<Database className="w-5 h-5" />}
              title="Comprehensive Analysis"
              description="View model leaderboards, compare responses side-by-side, and export curated datasets for fine-tuning or further analysis."
            />
            
            <Feature
              icon={<Sparkles className="w-5 h-5 text-pink-500" />}
              title="Enhanced Prompts"
              description="Models marked with the sparkles symbol used an enhanced system prompt with detailed therapeutic guidelines and response structure. This tests how prompt engineering affects therapeutic response quality compared to baseline prompts."
            />
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <div className="bg-blue-900/10 border border-blue-500/20 rounded p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Quick Start</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• <span className="text-zinc-300">Dashboard</span> - View model rankings and overall performance</li>
                <li>• <span className="text-zinc-300">Questions</span> - Explore individual scenarios and responses</li>
                <li>• <span className="text-zinc-300">Click any model</span> - See detailed breakdown with AI reasoning</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const Feature = ({ icon, title, description }: FeatureProps) => {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 mt-1">
        <div className="bg-zinc-800 p-2 rounded text-emerald-400">
          {icon}
        </div>
      </div>
      <div>
        <h3 className="text-white font-medium mb-1">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
};
