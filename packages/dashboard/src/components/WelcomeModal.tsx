import { X, Sparkles, BarChart3, UserCheck, Database } from 'lucide-react';

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
            A comprehensive benchmarking platform for evaluating how well Language Models handle therapeutic scenarios across CBT, DBT, ACT, and Safety protocols
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <Feature
              icon={<BarChart3 className="w-5 h-5" />}
              title="Automated Model Evaluation"
              description="Models respond to therapeutic scenarios and are evaluated by judge models on key metrics: overall score, safety, empathy, and modality adherence (how well they follow CBT/DBT/ACT principles)."
            />
            
            <Feature
              icon={<UserCheck className="w-5 h-5" />}
              title="Expert Review & Annotation"
              description="Override AI assessments, rank model responses, edit question rubrics, and add detailed notes. All annotations are stored locally in your browser for complete privacy."
            />
            
            <Feature
              icon={<Database className="w-5 h-5" />}
              title="Multi-Dimensional Analysis"
              description="Track reliability metrics, judge consistency, and judge agreement. Compare models side-by-side and export annotated datasets for fine-tuning or research."
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
