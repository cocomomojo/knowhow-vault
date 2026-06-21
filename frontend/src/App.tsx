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
        <h1>Know-how Vault</h1>
        <p>ノウハウ収集 → 分析 → 整理 → ベストプラクティス更新</p>
      </header>

      <nav className="tabs">
        {(['capture', 'workflow', 'best'] as Tab[]).map((key) => (
          <button key={key} onClick={() => setTab(key)}>
            {key === 'capture' ? '収集' : key === 'workflow' ? 'ワークフロー' : 'ベストプラクティス'}
          </button>
        ))}
      </nav>

      {tab === 'capture' && (
        <section className="card">
          <h2>ノウハウを収集</h2>
          <button onClick={handleCreateTheme}>テーマを追加</button>
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
          <h2>ワークフロー</h2>
          <ul className="list">
            {knowhow.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <div>テーマ: {item.theme?.name ?? '未設定'}</div>
                <div>状態: {item.status}</div>
                <div>重要度: {item.importance}</div>
                <p>{item.content}</p>
                <div className="actions">
                  <button onClick={() => handleAnalyze(item.id)}>分析</button>
                  <button onClick={() => handleOrganize(item.id)}>整理</button>
                  <button onClick={() => handlePublish(item.id)}>ベストプラクティス化</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'best' && (
        <section className="card">
          <h2>ベストプラクティス</h2>
          <ul className="list">
            {bestPractices.map((practice) => (
              <li key={practice.id}>
                <strong>{practice.title}</strong>
                <div>{practice.summary}</div>
                <p>{practice.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default App;
