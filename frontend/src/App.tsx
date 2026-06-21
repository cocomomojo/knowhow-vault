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

type PersistedState = {
  themes: Theme[];
  knowhow: KnowhowItem[];
  bestPractices: BestPractice[];
};

const emptyForm = {
  title: '',
  themeId: '',
  content: '',
  source: '',
  importance: 3,
};

const STORAGE_KEY = 'knowhow-vault-state:v1';

const readPersistedState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return { themes: [], knowhow: [], bestPractices: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { themes: [], knowhow: [], bestPractices: [] };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      knowhow: Array.isArray(parsed.knowhow) ? parsed.knowhow : [],
      bestPractices: Array.isArray(parsed.bestPractices) ? parsed.bestPractices : [],
    };
  } catch {
    return { themes: [], knowhow: [], bestPractices: [] };
  }
};

const persistState = ({ themes, knowhow, bestPractices }: PersistedState) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ themes, knowhow, bestPractices }));
  }
};

function App() {
  const [tab, setTab] = useState<Tab>('capture');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [knowhow, setKnowhow] = useState<KnowhowItem[]>([]);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState<string | null>(null);

  const collectedCount = knowhow.filter((item) => item.status === 'collected').length;
  const analyzedCount = knowhow.filter((item) => item.status === 'analyzed').length;
  const publishedCount = knowhow.filter((item) => item.status === 'published').length;
  const practiceCount = bestPractices.length;

  const loadAll = async () => {
    const persisted = readPersistedState();
    setThemes(persisted.themes);
    setKnowhow(persisted.knowhow);
    setBestPractices(persisted.bestPractices);

    try {
      const [themesRes, knowhowRes, practicesRes] = await Promise.all([
        fetch('/api/themes'),
        fetch('/api/knowhow'),
        fetch('/api/best-practices'),
      ]);

      if (themesRes.ok && knowhowRes.ok && practicesRes.ok) {
        const nextThemes = await themesRes.json();
        const nextKnowhow = await knowhowRes.json();
        const nextBestPractices = await practicesRes.json();
        setThemes(nextThemes);
        setKnowhow(nextKnowhow);
        setBestPractices(nextBestPractices);
        persistState({ themes: nextThemes, knowhow: nextKnowhow, bestPractices: nextBestPractices });
        setNotice(null);
        return;
      }
    } catch {
      // fall back to local storage data below
    }

    setNotice('バックエンドに接続できないため、入力内容はブラウザに保存されています。');
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleCreateTheme = async () => {
    const name = window.prompt('テーマ名を入力してください');
    if (!name) return;

    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: '追加テーマ' }),
      });

      if (res.ok) {
        await loadAll();
        return;
      }
    } catch {
      // fall back to local storage
    }

    const newTheme: Theme = { id: `theme-${Date.now()}`, name, description: '追加テーマ' };
    const nextThemes = [newTheme, ...themes];
    setThemes(nextThemes);
    persistState({ themes: nextThemes, knowhow, bestPractices });
    setNotice('テーマはローカルに保存されました。');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/knowhow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm(emptyForm);
        await loadAll();
        setTab('workflow');
        return;
      }
    } catch {
      // fall back to local storage
    }

    const newItem: KnowhowItem = {
      id: `knowhow-${Date.now()}`,
      title: form.title,
      content: form.content,
      source: form.source || null,
      importance: form.importance,
      status: 'collected',
      themeId: form.themeId,
      theme: themes.find((theme) => theme.id === form.themeId),
    };

    const nextKnowhow = [newItem, ...knowhow];
    setKnowhow(nextKnowhow);
    persistState({ themes, knowhow: nextKnowhow, bestPractices });
    setForm(emptyForm);
    setTab('workflow');
    setNotice('ノウハウはローカルに保存されました。');
  };

  const handleAnalyze = async (id: string) => {
    try {
      const res = await fetch(`/api/knowhow/${id}/analyze`, { method: 'POST' });
      if (res.ok) {
        await loadAll();
        return;
      }
    } catch {
      // fall back to local storage
    }

    const nextKnowhow = knowhow.map((item) => (item.id === id ? { ...item, status: 'analyzed' } : item));
    setKnowhow(nextKnowhow);
    persistState({ themes, knowhow: nextKnowhow, bestPractices });
    setNotice('分析状態をローカルで更新しました。');
  };

  const handleOrganize = async (id: string) => {
    try {
      const res = await fetch(`/api/knowhow/${id}/organize`, { method: 'POST' });
      if (res.ok) {
        await loadAll();
        return;
      }
    } catch {
      // fall back to local storage
    }

    const nextKnowhow = knowhow.map((item) => (item.id === id ? { ...item, status: 'analyzed' } : item));
    setKnowhow(nextKnowhow);
    persistState({ themes, knowhow: nextKnowhow, bestPractices });
    setNotice('整理状態をローカルで更新しました。');
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/knowhow/${id}/publish`, { method: 'POST' });
      if (res.ok) {
        await loadAll();
        return;
      }
    } catch {
      // fall back to local storage
    }

    const targetItem = knowhow.find((item) => item.id === id);
    if (!targetItem) return;

    const nextKnowhow = knowhow.map((item) => (item.id === id ? { ...item, status: 'published' } : item));
    const practice: BestPractice = {
      id: `practice-${Date.now()}`,
      title: targetItem.title,
      summary: targetItem.content.slice(0, 120),
      content: targetItem.content,
      status: 'draft',
      knowhowId: id,
    };
    const nextBestPractices = [practice, ...bestPractices];
    setKnowhow(nextKnowhow);
    setBestPractices(nextBestPractices);
    persistState({ themes, knowhow: nextKnowhow, bestPractices: nextBestPractices });
    setNotice('ベストプラクティスをローカルに追加しました。');
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
          <div className="helper-box">まずはテーマを作ってから、経験や気づきを残すと次のステップに進めます。</div>
          {notice && <div className="helper-box">{notice}</div>}
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
              <p>収集したものを、分析・整理・公開へ進めます。</p>
            </div>
          </div>
          <div className="helper-box">「分析」→「整理」→「ベストプラクティス化」の順で進めると、知見が自然に育ちます。</div>
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
