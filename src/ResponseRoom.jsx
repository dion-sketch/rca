// ResponseRoom.jsx - Professional-Friendly Voice
// Date: December 28, 2025
// All functional fixes included, neutral professional tone

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ResponseRoom({ submissionId, onBack, businessProfile }) {
  // Core state
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  
  // Phase navigation
  const [currentPhase, setCurrentPhase] = useState(1);
  const [activeSection, setActiveSection] = useState('questions');
  
  // RFP Type
  const [rfpType, setRfpType] = useState(null);
  const [showRfpTypeSelector, setShowRfpTypeSelector] = useState(false);
  
  // Manual Questions
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState({ text: '', weight: '', section: 'general' });
  
  // Answers
  const [answers, setAnswers] = useState({});
  
  // Strategy
  const [strategy, setStrategy] = useState({
    dbaSelection: '',
    approachNotes: ''
  });
  
  // Scope items
  const [scopeItems, setScopeItems] = useState([]);
  
  // References - no Contract Value field
  const [references, setReferences] = useState([{
    organization: '',
    contactName: '',
    title: '',
    phone: '',
    email: '',
    relationship: ''
  }]);
  
  // Key Personnel
  const [keyPersonnel, setKeyPersonnel] = useState([{
    name: '',
    role: '',
    qualifications: '',
    hoursPerWeek: 40,
    hourlyRate: 0,
    isFlexible: true
  }]);
  
  // Budget
  const [budget, setBudget] = useState({
    fringeRate: 30,
    indirectRate: 10,
    total: 0
  });
  
  // Review
  const [disclaimersAccepted, setDisclaimersAccepted] = useState({
    reviewedContent: false,
    aiAssisted: false,
    personnelAuthorized: false,
    referencesPermission: false
  });
  
  // Celebration & Feedback
  const [showCelebration, setShowCelebration] = useState(false);
  const [bucketFeedback, setBucketFeedback] = useState([]);

  // Phases
  const phases = [
    { id: 1, name: 'Overview' },
    { id: 2, name: 'Strategy' },
    { id: 3, name: 'Scope' },
    { id: 4, name: 'Answers' },
    { id: 5, name: 'Review' },
    { id: 6, name: 'Export' }
  ];

  // ============================================
  // LOAD DATA
  // ============================================
  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single();
      
      if (error) throw error;
      setSubmission(data);
      
      if (data.answers) setAnswers(typeof data.answers === 'string' ? JSON.parse(data.answers) : data.answers);
      if (data.questions) setQuestions(typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions);
      if (data.strategy) setStrategy(typeof data.strategy === 'string' ? JSON.parse(data.strategy) : data.strategy);
      if (data.scope_items) setScopeItems(typeof data.scope_items === 'string' ? JSON.parse(data.scope_items) : data.scope_items);
      if (data.references) setReferences(typeof data.references === 'string' ? JSON.parse(data.references) : data.references);
      if (data.key_personnel) setKeyPersonnel(typeof data.key_personnel === 'string' ? JSON.parse(data.key_personnel) : data.key_personnel);
      
      if (data.rfp_type) {
        setRfpType(data.rfp_type);
      } else {
        setShowRfpTypeSelector(true);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RFP TYPE SELECTOR
  // ============================================
  const RFPTypeSelector = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6">
        <h2 className="text-xl font-bold text-white mb-2">Select Solicitation Type</h2>
        <p className="text-slate-400 text-sm mb-6">
          Choose the type that matches your RFP document.
        </p>
        
        <div className="space-y-2">
          {[
            { type: 'rfp', name: 'RFP - Request for Proposal', desc: 'Narrative responses with scored sections' },
            { type: 'rfsq', name: 'RFSQ - Statement of Qualifications', desc: 'Forms and documents to verify qualifications' },
            { type: 'rfq', name: 'RFQ - Request for Quote', desc: 'Pricing and cost proposal' },
            { type: 'ifb', name: 'IFB - Invitation for Bid', desc: 'Lowest price that meets specifications' },
            { type: 'grant', name: 'Grant Application', desc: 'Program narrative with outcomes focus' }
          ].map(item => (
            <button
              key={item.type}
              onClick={() => handleRfpTypeSelect(item.type)}
              className="w-full text-left p-4 rounded-lg border border-slate-600 hover:border-emerald-500 hover:bg-slate-700/50 transition-all"
            >
              <div className="font-medium text-white">{item.name}</div>
              <div className="text-sm text-slate-400">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const handleRfpTypeSelect = async (type) => {
    setRfpType(type);
    setShowRfpTypeSelector(false);
    
    await supabase
      .from('submissions')
      .update({ rfp_type: type })
      .eq('id', submissionId);
    
    if (type === 'rfsq') {
      setActiveSection('rfsq-checklist');
    }
  };

  // ============================================
  // QUESTION ENTRY
  // ============================================
  const QuestionEntryPanel = () => (
    <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">RFP Questions</h3>
        <span className="text-sm text-slate-400">{questions.length} added</span>
      </div>
      
      <p className="text-slate-400 text-sm mb-4">
        Enter the questions from your RFP document.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Question Text *</label>
          <textarea
            value={newQuestion.text}
            onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
            placeholder="Enter the question from your RFP..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 min-h-[100px]"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Points/Weight</label>
            <input
              type="text"
              value={newQuestion.weight}
              onChange={(e) => setNewQuestion({...newQuestion, weight: e.target.value})}
              placeholder="e.g., 25 points"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500"
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1">Category</label>
            <select
              value={newQuestion.section}
              onChange={(e) => setNewQuestion({...newQuestion, section: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
            >
              <option value="general">General</option>
              <option value="understanding">Understanding of Need</option>
              <option value="technical">Technical Approach</option>
              <option value="experience">Past Performance</option>
              <option value="personnel">Key Personnel</option>
              <option value="management">Management</option>
              <option value="budget">Budget</option>
            </select>
          </div>
        </div>
        
        <button
          onClick={addQuestion}
          disabled={!newQuestion.text.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
        >
          Add Question
        </button>
      </div>
      
      {questions.length > 0 && (
        <div className="mt-6 space-y-2">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg">
              <span className="text-emerald-500 font-medium">{idx + 1}.</span>
              <div className="flex-1">
                <p className="text-white text-sm">{q.text}</p>
                <div className="flex gap-2 mt-1">
                  {q.weight && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{q.weight}</span>
                  )}
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded capitalize">{q.section}</span>
                  {answers[q.id] && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Answered</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeQuestion(idx)}
                className="text-slate-500 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const addQuestion = async () => {
    if (!newQuestion.text.trim()) return;
    
    const q = { ...newQuestion, id: `q-${Date.now()}` };
    const updated = [...questions, q];
    setQuestions(updated);
    setNewQuestion({ text: '', weight: '', section: 'general' });
    
    await supabase
      .from('submissions')
      .update({ questions: updated })
      .eq('id', submissionId);
  };

  const removeQuestion = async (idx) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    
    await supabase
      .from('submissions')
      .update({ questions: updated })
      .eq('id', submissionId);
  };

  // ============================================
  // GENERATE RESPONSE
  // ============================================
  const generateCRFAnswer = async (questionId, questionText) => {
    setGenerating(true);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          questionText,
          businessProfile,
          submission,
          strategy,
          scopeItems
        })
      });
      
      if (!response.ok) throw new Error('Generation failed');
      
      const data = await response.json();
      
      const newAnswers = {
        ...answers,
        [questionId]: {
          raw: data.response,
          answer: data.crfParts?.answer || '',
          magnetism: data.crfParts?.magnetism || '',
          outcome: data.crfParts?.outcome || '',
          generatedAt: new Date().toISOString()
        }
      };
      
      setAnswers(newAnswers);
      await saveAnswers(newAnswers);
      
    } catch (err) {
      setError('Failed to generate response. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ============================================
  // SAVE FUNCTIONS
  // ============================================
  const saveAnswers = async (answersToSave) => {
    setSaving(true);
    try {
      await supabase
        .from('submissions')
        .update({ 
          answers: answersToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);
      setLastSaved(new Date());
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (sectionName, data) => {
    setSaving(true);
    try {
      await supabase
        .from('submissions')
        .update({ 
          [sectionName]: data,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);
      setLastSaved(new Date());
      setBucketFeedback(prev => [...prev, `${sectionName} saved`]);
    } catch (err) {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // PHASE 1: OVERVIEW
  // ============================================
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-slate-400 text-sm mb-1">OPPORTUNITY</p>
            <h2 className="text-2xl font-bold text-white mb-2">
              {submission?.title || submission?.contract_title}
            </h2>
            
            {/* FIXED: Agency field */}
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span>Agency: {submission?.agency || 'Not specified'}</span>
              <span>Due: {submission?.due_date || 'Not specified'}</span>
              <span>Value: {submission?.estimated_value ? `$${parseInt(submission.estimated_value).toLocaleString()}` : 'Not specified'}</span>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">Match Score</p>
            <p className="text-3xl font-bold text-emerald-400">
              {submission?.cr_match_score || submission?.match_score || '--'}%
            </p>
          </div>
        </div>
      </div>
      
      {/* Suggested Program Title */}
      <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-6">
        <p className="text-slate-400 text-sm mb-1">Suggested Program Title</p>
        <p className="text-xl font-semibold text-white">
          "{submission?.suggested_title || 'Program Title'}"
        </p>
      </div>
      
      {/* DBA Selection */}
      <div className="bg-slate-800/50 rounded-xl p-6">
        <label className="block text-sm text-slate-300 mb-2">Responding As</label>
        <select
          value={strategy.dbaSelection}
          onChange={(e) => setStrategy({...strategy, dbaSelection: e.target.value})}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
        >
          <option value="">Select business name...</option>
          <option value="primary">{businessProfile?.company_name || 'Primary Company'}</option>
          {businessProfile?.dba_names?.map((dba, idx) => (
            <option key={idx} value={dba}>{dba} (DBA)</option>
          ))}
        </select>
      </div>
      
      {/* RFP Type */}
      <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-slate-400 text-sm">Solicitation Type:</span>
          <span className="text-white font-medium ml-2 uppercase">{rfpType || 'Not set'}</span>
        </div>
        <button
          onClick={() => setShowRfpTypeSelector(true)}
          className="text-emerald-400 hover:text-emerald-300 text-sm"
        >
          Change
        </button>
      </div>
    </div>
  );

  // ============================================
  // PHASE 2: STRATEGY
  // ============================================
  const renderStrategy = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Response Strategy</h3>
        
        <div>
          <label className="block text-sm text-slate-300 mb-2">Key Advantages</label>
          <textarea
            value={strategy.approachNotes}
            onChange={(e) => setStrategy({...strategy, approachNotes: e.target.value})}
            placeholder="What makes you the best fit for this opportunity?"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 min-h-[120px]"
          />
        </div>
        
        <button
          onClick={() => saveSection('strategy', strategy)}
          disabled={saving}
          className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );

  // ============================================
  // PHASE 3: SCOPE
  // ============================================
  const renderScope = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Scope Items</h3>
        <p className="text-slate-400 text-sm mb-4">Add key deliverables from the RFP.</p>
        
        <div className="space-y-2">
          {scopeItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-slate-500">{idx + 1}.</span>
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const updated = [...scopeItems];
                  updated[idx] = e.target.value;
                  setScopeItems(updated);
                }}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
              />
              <button
                onClick={() => setScopeItems(scopeItems.filter((_, i) => i !== idx))}
                className="text-slate-500 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setScopeItems([...scopeItems, ''])}
          className="mt-4 w-full border border-dashed border-slate-600 hover:border-slate-500 rounded-lg p-3 text-slate-400 hover:text-slate-300 transition-colors"
        >
          + Add Item
        </button>
        
        <button
          onClick={() => saveSection('scope_items', scopeItems)}
          disabled={saving}
          className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );

  // ============================================
  // PHASE 4: ANSWERS
  // ============================================
  const renderAnswers = () => (
    <div className="space-y-6">
      <QuestionEntryPanel />
      
      {questions.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">Responses</h3>
          
          {questions.map((question, idx) => (
            <div key={question.id} className="bg-slate-800/50 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-emerald-500 font-medium">Q{idx + 1}</span>
                    {question.weight && (
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{question.weight}</span>
                    )}
                  </div>
                  <p className="text-white">{question.text}</p>
                </div>
                
                <button
                  onClick={() => generateCRFAnswer(question.id, question.text)}
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  {generating ? 'Generating...' : 'Generate Draft'}
                </button>
              </div>
              
              {/* CRF 3-PART STRUCTURE */}
              <div className="space-y-4">
                <div className="border-l-2 border-blue-500 pl-4">
                  <label className="block text-sm text-blue-400 font-medium mb-1">Part 1: Answer</label>
                  <textarea
                    value={answers[question.id]?.answer || ''}
                    onChange={(e) => setAnswers({
                      ...answers,
                      [question.id]: { ...answers[question.id], answer: e.target.value }
                    })}
                    placeholder="Lead with your solution (1-2 sentences)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 min-h-[80px]"
                  />
                </div>
                
                <div className="border-l-2 border-purple-500 pl-4">
                  <label className="block text-sm text-purple-400 font-medium mb-1">Part 2: Magnetism</label>
                  <textarea
                    value={answers[question.id]?.magnetism || ''}
                    onChange={(e) => setAnswers({
                      ...answers,
                      [question.id]: { ...answers[question.id], magnetism: e.target.value }
                    })}
                    placeholder="Their need + Your approach + Your proof (2-3 sentences)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 min-h-[100px]"
                  />
                </div>
                
                <div className="border-l-2 border-emerald-500 pl-4">
                  <label className="block text-sm text-emerald-400 font-medium mb-1">Part 3: Outcome</label>
                  <textarea
                    value={answers[question.id]?.outcome || ''}
                    onChange={(e) => setAnswers({
                      ...answers,
                      [question.id]: { ...answers[question.id], outcome: e.target.value }
                    })}
                    placeholder="What result they get (1-2 sentences)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 min-h-[80px]"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                <label className="flex items-center gap-2 text-slate-400 text-sm">
                  <input type="checkbox" className="rounded border-slate-600 bg-slate-900 text-emerald-500" />
                  Save to Bucket
                </label>
                
                <button
                  onClick={() => saveAnswers(answers)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white text-sm rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Sub-sections */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setActiveSection('references')}
          className={`p-4 rounded-lg border transition-colors text-left ${
            activeSection === 'references' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          <p className="text-white font-medium">References</p>
          <p className="text-slate-400 text-xs mt-1">{references.filter(r => r.organization).length} added</p>
        </button>
        
        <button
          onClick={() => setActiveSection('personnel')}
          className={`p-4 rounded-lg border transition-colors text-left ${
            activeSection === 'personnel' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          <p className="text-white font-medium">Key Personnel</p>
          <p className="text-slate-400 text-xs mt-1">{keyPersonnel.filter(p => p.role).length} added</p>
        </button>
        
        <button
          onClick={() => setActiveSection('budget')}
          className={`p-4 rounded-lg border transition-colors text-left ${
            activeSection === 'budget' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          <p className="text-white font-medium">Budget</p>
          <p className="text-slate-400 text-xs mt-1">${budget.total.toLocaleString()}</p>
        </button>
      </div>
      
      {activeSection === 'references' && renderReferences()}
      {activeSection === 'personnel' && renderPersonnel()}
      {activeSection === 'budget' && renderBudget()}
    </div>
  );

  // ============================================
  // REFERENCES - No Contract Value
  // ============================================
  const renderReferences = () => (
    <div className="bg-slate-800/50 rounded-xl p-6 mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">References</h3>
      <p className="text-slate-400 text-sm mb-4">Add 2-3 contacts who can verify your work.</p>
      
      {references.map((ref, idx) => (
        <div key={idx} className="border border-slate-600 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Reference {idx + 1}</span>
            {references.length > 1 && (
              <button
                onClick={() => setReferences(references.filter((_, i) => i !== idx))}
                className="text-slate-500 hover:text-red-400 text-sm"
              >
                Remove
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Organization *</label>
              <input
                type="text"
                value={ref.organization}
                onChange={(e) => {
                  const updated = [...references];
                  updated[idx].organization = e.target.value;
                  setReferences(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Contact Name *</label>
              <input
                type="text"
                value={ref.contactName}
                onChange={(e) => {
                  const updated = [...references];
                  updated[idx].contactName = e.target.value;
                  setReferences(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title</label>
              <input
                type="text"
                value={ref.title}
                onChange={(e) => {
                  const updated = [...references];
                  updated[idx].title = e.target.value;
                  setReferences(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Phone</label>
              <input
                type="tel"
                value={ref.phone}
                onChange={(e) => {
                  const updated = [...references];
                  updated[idx].phone = e.target.value;
                  setReferences(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={ref.email}
                onChange={(e) => {
                  const updated = [...references];
                  updated[idx].email = e.target.value;
                  setReferences(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Relationship</label>
              <input
                type="text"
                value={ref.relationship}
                onChange={(e) => {
                  const updated = [...references];
                  updated[idx].relationship = e.target.value;
                  setReferences(updated);
                }}
                placeholder="How they know your work"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      ))}
      
      <button
        onClick={() => setReferences([...references, { organization: '', contactName: '', title: '', phone: '', email: '', relationship: '' }])}
        className="w-full border border-dashed border-slate-600 hover:border-slate-500 rounded-lg p-3 text-slate-400 hover:text-slate-300 transition-colors"
      >
        + Add Reference
      </button>
      
      <button
        onClick={() => saveSection('references', references)}
        disabled={saving}
        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save References'}
      </button>
    </div>
  );

  // ============================================
  // KEY PERSONNEL
  // ============================================
  const renderPersonnel = () => (
    <div className="bg-slate-800/50 rounded-xl p-6 mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Key Personnel</h3>
      
      {keyPersonnel.map((person, idx) => (
        <div key={idx} className="border border-slate-600 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Team Member {idx + 1}</span>
            {keyPersonnel.length > 1 && (
              <button
                onClick={() => setKeyPersonnel(keyPersonnel.filter((_, i) => i !== idx))}
                className="text-slate-500 hover:text-red-400 text-sm"
              >
                Remove
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role *</label>
              <input
                type="text"
                value={person.role}
                onChange={(e) => {
                  const updated = [...keyPersonnel];
                  updated[idx].role = e.target.value;
                  setKeyPersonnel(updated);
                }}
                placeholder="e.g., Program Director"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name (or TBD)</label>
              <input
                type="text"
                value={person.name}
                onChange={(e) => {
                  const updated = [...keyPersonnel];
                  updated[idx].name = e.target.value;
                  setKeyPersonnel(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Qualifications</label>
              <textarea
                value={person.qualifications}
                onChange={(e) => {
                  const updated = [...keyPersonnel];
                  updated[idx].qualifications = e.target.value;
                  setKeyPersonnel(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm min-h-[60px]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hours/Week</label>
              <input
                type="number"
                value={person.hoursPerWeek}
                onChange={(e) => {
                  const updated = [...keyPersonnel];
                  updated[idx].hoursPerWeek = parseInt(e.target.value) || 0;
                  setKeyPersonnel(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hourly Rate</label>
              <input
                type="number"
                value={person.hourlyRate}
                onChange={(e) => {
                  const updated = [...keyPersonnel];
                  updated[idx].hourlyRate = parseInt(e.target.value) || 0;
                  setKeyPersonnel(updated);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
              />
            </div>
          </div>
          
          <label className="flex items-center gap-2 mt-3 text-slate-400 text-sm">
            <input
              type="checkbox"
              checked={person.isFlexible}
              onChange={(e) => {
                const updated = [...keyPersonnel];
                updated[idx].isFlexible = e.target.checked;
                setKeyPersonnel(updated);
              }}
              className="rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
            Staffing may be adjusted as needed
          </label>
        </div>
      ))}
      
      <button
        onClick={() => setKeyPersonnel([...keyPersonnel, { name: '', role: '', qualifications: '', hoursPerWeek: 40, hourlyRate: 0, isFlexible: true }])}
        className="w-full border border-dashed border-slate-600 hover:border-slate-500 rounded-lg p-3 text-slate-400 hover:text-slate-300 transition-colors"
      >
        + Add Team Member
      </button>
      
      <button
        onClick={() => saveSection('key_personnel', keyPersonnel)}
        disabled={saving}
        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save Personnel'}
      </button>
    </div>
  );

  // ============================================
  // BUDGET
  // ============================================
  const renderBudget = () => {
    const personnelTotal = keyPersonnel.reduce((sum, p) => sum + (p.hoursPerWeek * 52 * p.hourlyRate), 0);
    const fringeAmount = personnelTotal * (budget.fringeRate / 100);
    const subtotal = personnelTotal + fringeAmount;
    const indirectAmount = subtotal * (budget.indirectRate / 100);
    const grandTotal = subtotal + indirectAmount;
    
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Budget Summary</h3>
          {submission?.estimated_value && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Available Funding</p>
              <p className="text-white font-medium">${parseInt(submission.estimated_value).toLocaleString()}</p>
            </div>
          )}
        </div>
        
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Personnel</span>
            <span className="text-white">${personnelTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Fringe ({budget.fringeRate}%)</span>
            <span className="text-white">${Math.round(fringeAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Indirect ({budget.indirectRate}%)</span>
            <span className="text-white">${Math.round(indirectAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-700">
            <span className="text-emerald-400 font-medium">Total</span>
            <span className="text-emerald-400 font-bold">${Math.round(grandTotal).toLocaleString()}</span>
          </div>
        </div>
        
        <button
          onClick={() => saveSection('budget', { ...budget, total: grandTotal })}
          disabled={saving}
          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Budget'}
        </button>
      </div>
    );
  };

  // ============================================
  // PHASE 5: REVIEW
  // ============================================
  const renderReview = () => {
    const checks = [
      { label: 'Questions entered', done: questions.length > 0 },
      { label: 'All questions answered', done: questions.every(q => answers[q.id]?.answer) },
      { label: 'References added', done: references.filter(r => r.organization).length >= 2 },
      { label: 'Key personnel identified', done: keyPersonnel.filter(p => p.role).length > 0 }
    ];
    
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pre-Submission Checklist</h3>
          
          <div className="space-y-3">
            {checks.map((check, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  check.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
                }`}>
                  {check.done ? '✓' : '○'}
                </span>
                <span className={check.done ? 'text-slate-300' : 'text-slate-500'}>{check.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Confirmations</h3>
          
          <div className="space-y-3">
            {[
              { id: 'reviewedContent', label: 'I have reviewed all content for accuracy' },
              { id: 'aiAssisted', label: 'I understand this is an AI-assisted draft' },
              { id: 'personnelAuthorized', label: 'All personnel are authorized to be named' },
              { id: 'referencesPermission', label: 'I have permission from all references' }
            ].map(item => (
              <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disclaimersAccepted[item.id]}
                  onChange={(e) => setDisclaimersAccepted({
                    ...disclaimersAccepted,
                    [item.id]: e.target.checked
                  })}
                  className="rounded border-slate-600 bg-slate-900 text-emerald-500"
                />
                <span className="text-slate-300 text-sm">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // PHASE 6: EXPORT
  // ============================================
  const renderExport = () => {
    const allDisclaimers = Object.values(disclaimersAccepted).every(v => v);
    
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Export Response</h2>
          <p className="text-slate-400 mb-6">Download your completed response.</p>
          
          {!allDisclaimers && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 text-amber-400 text-sm">
              Please accept all confirmations in Review before exporting.
            </div>
          )}
          
          <div className="flex gap-4 justify-center">
            <button
              disabled={!allDisclaimers}
              onClick={() => setShowCelebration(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Export as Word
            </button>
            <button
              disabled={!allDisclaimers}
              onClick={() => setShowCelebration(true)}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Export as PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // COMPLETION SCREEN
  // ============================================
  const CompletionScreen = () => (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-white mb-2">Response Exported</h1>
        <p className="text-slate-400 mb-6">Your response is ready for submission.</p>
        
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 text-left">
          <p className="text-slate-300 text-sm">Summary:</p>
          <p className="text-slate-400 text-sm">• {questions.length} questions answered</p>
          <p className="text-slate-400 text-sm">• {references.filter(r => r.organization).length} references</p>
          <p className="text-slate-400 text-sm">• {keyPersonnel.filter(p => p.role).length} team members</p>
        </div>
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => setShowCelebration(false)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            Back to Response
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {showRfpTypeSelector && <RFPTypeSelector />}
      {showCelebration && <CompletionScreen />}
      
      {/* Header */}
      <div className="border-b border-slate-700 p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white">← Back</button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold truncate">{submission?.title || 'Response'}</h1>
            <p className="text-sm text-slate-400">
              {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
            </p>
          </div>
        </div>
      </div>
      
      {/* Phase Progress */}
      <div className="border-b border-slate-700 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setCurrentPhase(phase.id)}
              className={`flex flex-col items-center ${
                currentPhase === phase.id ? 'text-emerald-400' : 
                currentPhase > phase.id ? 'text-emerald-600' : 'text-slate-500'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 text-sm ${
                currentPhase === phase.id ? 'bg-emerald-500 text-white' :
                currentPhase > phase.id ? 'bg-emerald-600/30' : 'bg-slate-700'
              }`}>
                {currentPhase > phase.id ? '✓' : phase.id}
              </div>
              <span className="text-xs">{phase.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {currentPhase === 1 && renderOverview()}
        {currentPhase === 2 && renderStrategy()}
        {currentPhase === 3 && renderScope()}
        {currentPhase === 4 && renderAnswers()}
        {currentPhase === 5 && renderReview()}
        {currentPhase === 6 && renderExport()}
      </div>
      
      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setCurrentPhase(Math.max(1, currentPhase - 1))}
            disabled={currentPhase === 1}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg"
          >
            Previous
          </button>
          <span className="text-slate-500 text-sm">{phases[currentPhase - 1]?.name}</span>
          <button
            onClick={() => setCurrentPhase(Math.min(phases.length, currentPhase + 1))}
            disabled={currentPhase === phases.length}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
