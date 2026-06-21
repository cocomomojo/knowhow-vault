import { useEffect, useState, type FormEvent } from 'react';
import './App.css';

type Theme = {
  id: string;
  name: string;
  description?: string | null;
};

type KnowhowItem = {
  id: string;
  title: string;
  content: string;
  source?: string | null;
  importance: number;
  status: string;
  themeId: string;
  theme?: Theme;
};

type BestPractice = {
  id: string;
  title: string;
  summary: string;
  content: string;
  status: string;
  knowhowId: string;
};

type Tab = 'capture' | 'workflow' | 'best';

const emptyForm = {
  title: '',
  themeId: '',
  content: '',
  source: '',
  importance: 3,
};

function App() {
  const [tab, setTab] = useState<Tab>('capture');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [knowhow, setKnowhow] = useState<KnowhowItem[]>([]);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [form, setForm] = useState(emptyForm);

  const collectedCount = knowhow.filter((item) => item.status === 'collected').length;
  const analyzedCount = knowhow.filter((item) => item.status === 'analyzed').length;
  const publishedCount = knowhow.filter((item) => item.status === 'published').length;
  const practiceCount = bestPractices.length;

  const loadAll = async () => {
    const [themesRes, knowhowRes, practicesRes] = await Promise.all([
      fetch('/api/themes'),
      fetch('/api/knowhow'),
      fetch('/api/best-practices'),
    ]);
    setThemes(await themesRes.json());
    setKnowhow(await knowhowRes.json());
    setBestPractices(await practicesRes.json());
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleCreateTheme = async () => {
    const name = window.prompt('テーマ名を入力してください');
    if (!name) return;
    const res = await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: '追加テーマ' }),
    });
    if (res.ok) {
      await loadAll();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/knowhow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(emptyForm);
      await loadAll();
      setTab('workflow');
    }
  };

  const handleAnalyze = async (id: string) => {
    await fetch(`/api/knowhow/${id}/analyze`, { method: 'POST' });
    await loadAll();
  };

  const handleOrganize = async (id: string) => {
    await fetch(`/api/knowhow/${id}/organize`, { method: 'POST' });
    await loadAll();
  };

  const handlePublish = async (id: string) => {
    await fetch(`/api/knowhow/${id}/publish`, { method: 'POST' });
    await loadAll();
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">知識を育てる、次の一歩をつなぐ</p>
          <h1>Know-how Vault</h1>
          <p className="hero-text">ノウハウを気軽に残して、分析・整理・再利用までスムーズに進めます。</p>
        </div>
        <div className="hero-stats" aria-label="summary">
          <div className="stat-card">
            <strong>{collectedCount}</strong>
            <span>収集済み</span>
          </div>
          <div className="stat-card">
            <strong>{analyzedCount}</strong>
            <span>分析済み</span>
          </div>
          <div className="stat-card">
            <strong>{practiceCount}</strong>
            <span>ベストプラクティス</span>
          </div>
          <div className="stat-card">
            <strong>{publishedCount}</strong>
            <span>公開済み</span>
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label="main tabs">
        {(['capture', 'workflow', 'best'] as Tab[]).map((key) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'active' : ''}>
            {key === 'capture' ? '収集' : key === 'workflow' ? 'ワークフロー' : 'ベストプラクティス'}
          </button>
        ))}
      </nav>

      {tab === 'capture' && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>ノウハウを収集</h2>
              <p>気づきや実践知を、すぐに残せるようにしましょう。</p>
            </div>
            <button onClick={handleCreateTheme} className="secondary">テーマを追加</button>
          </div>
          <form onSubmit={handleSubmit} className="form-grid">
            <input
              placeholder="タイトル"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <select
              value={form.themeId}
              onChange={(e) => setForm({ ...form, themeId: e.target.value })}
              required
            >
              <option value="">テーマを選択</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            <textarea
              rows={6}
              placeholder="内容"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
            <input
              placeholder="参考リンクや出典"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
            <input
              type="number"
              min="1"
              max="5"
              value={form.importance}
              onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
            />
            <button type="submit">保存</button>
          </form>
        </section>
      )}

      {tab === 'workflow' && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>ワークフロー</h2>
              <p>収集した内容を、分析・整理・公開へ進めます。</p>
            </div>
          </div>
          {knowhow.length === 0 ? (
            <div className="empty-state">まだノウハウがありません。まずは収集タブから追加してみてください。</div>
          ) : (
            <ul className="list">
              {knowhow.map((item) => (
                <li key={item.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{item.title}</strong>
                    <span className={`status-pill status-${item.status}`}>{item.status}</span>
                  </div>
                  <div>テーマ: {item.theme?.name ?? '未設定'}</div>
                  <div>重要度: {item.importance}/5</div>
                  <p>{item.content}</p>
                  <div className="actions">
                    <button onClick={() => handleAnalyze(item.id)}>分析</button>
                    <button onClick={() => handleOrganize(item.id)}>整理</button>
                    <button onClick={() => handlePublish(item.id)}>ベストプラクティス化</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'best' && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>ベストプラクティス</h2>
              <p>再利用しやすい知見を、すぐに見返せる形で整理します。</p>
            </div>
          </div>
          {bestPractices.length === 0 ? (
            <div className="empty-state">まだベストプラクティスがありません。ワークフローで公開するとここに表示されます。</div>
          ) : (
            <ul className="list">
              {bestPractices.map((practice) => (
                <li key={practice.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{practice.title}</strong>
                    <span className="status-pill">published</span>
                  </div>
                  <div>{practice.summary}</div>
                  <p>{practice.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
