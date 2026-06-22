import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from './lib/api';
import type { BestPractice, CollectionSource, KnowhowItem, Theme } from './types';
import './App.css';

type Tab = 'capture' | 'workflow' | 'best';

type KnowhowForm = {
  title: string;
  themeId: string;
  content: string;
  source: string;
  importance: number;
};

type SourceForm = {
  name: string;
  url: string;
  themeId: string;
  type: string;
};

const emptyKnowhowForm: KnowhowForm = {
  title: '',
  themeId: '',
  content: '',
  source: '',
  importance: 3,
};

const emptySourceForm: SourceForm = {
  name: '',
  url: '',
  themeId: '',
  type: 'rss',
};

function App() {
  const [tab, setTab] = useState<Tab>('capture');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [knowhow, setKnowhow] = useState<KnowhowItem[]>([]);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [sources, setSources] = useState<CollectionSource[]>([]);
  const [form, setForm] = useState<KnowhowForm>(emptyKnowhowForm);
  const [sourceForm, setSourceForm] = useState<SourceForm>(emptySourceForm);
  const [backendReady, setBackendReady] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collectedCount = useMemo(() => knowhow.filter((item) => item.status === 'collected').length, [knowhow]);
  const analyzedCount = useMemo(() => knowhow.filter((item) => item.status === 'analyzed').length, [knowhow]);
  const publishedCount = useMemo(() => knowhow.filter((item) => item.status === 'published').length, [knowhow]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const [health, themesData, knowhowData, practicesData, sourcesData] = await Promise.all([
        api.health(),
        api.listThemes(),
        api.listKnowhow(),
        api.listBestPractices(),
        api.listCollectionSources(),
      ]);

      setBackendReady(Boolean(health.ok));
      setAiReady(Boolean(health.aiConfigured));
      setThemes(themesData);
      setKnowhow(knowhowData);
      setBestPractices(practicesData);
      setSources(sourcesData);
      setMessage(null);
    } catch (loadError) {
      setBackendReady(false);
      setAiReady(false);
      setError('バックエンドへ接続できません。DB 登録と Copilot 分析を利用するには API を起動してください。');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const executeAction = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    setError(null);
    setMessage(null);

    try {
      await action();
    } catch (actionError) {
      const nextMessage = actionError instanceof Error ? actionError.message : '処理に失敗しました。';
      setError(nextMessage);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateTheme = async () => {
    const name = window.prompt('テーマ名を入力してください');
    if (!name) return;

    await executeAction('create-theme', async () => {
      await api.createTheme({ name, description: '追加テーマ' });
      await loadAll();
      setMessage(`テーマ「${name}」を登録しました。`);
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    await executeAction('create-knowhow', async () => {
      await api.createKnowhow(form);
      setForm(emptyKnowhowForm);
      await loadAll();
      setTab('workflow');
      setMessage('ノウハウを DB に登録しました。');
    });
  };

  const handleAddSource = async (event: FormEvent) => {
    event.preventDefault();

    await executeAction('create-source', async () => {
      await api.createCollectionSource(sourceForm);
      setSourceForm(emptySourceForm);
      await loadAll();
      setMessage('自動収集ソースを登録しました。');
    });
  };

  const handleCollectSource = async (id: string) => {
    await executeAction(`collect-${id}`, async () => {
      const result = await api.collectSource(id);
      await loadAll();
      setMessage(`自動収集を実行しました。新規 ${result.createdCount} 件、重複 ${result.skippedCount} 件です。`);
    });
  };

  const handleCollectAllSources = async () => {
    await executeAction('collect-all', async () => {
      const result = await api.collectAllSources();
      const createdCount = result.results.reduce((total, item) => total + item.createdCount, 0);
      const skippedCount = result.results.reduce((total, item) => total + item.skippedCount, 0);
      await loadAll();
      setMessage(`全ソースの収集を実行しました。新規 ${createdCount} 件、重複 ${skippedCount} 件です。`);
    });
  };

  const handleAnalyze = async (id: string) => {
    await executeAction(`analyze-${id}`, async () => {
      await api.analyzeKnowhow(id);
      await loadAll();
      setMessage(aiReady ? 'Copilot による分析を更新しました。' : 'ローカル分析で結果を更新しました。');
    });
  };

  const handleOrganize = async (id: string) => {
    await executeAction(`organize-${id}`, async () => {
      await api.organizeKnowhow(id);
      await loadAll();
      setMessage('整理ステータスを更新しました。');
    });
  };

  const handlePublish = async (id: string) => {
    await executeAction(`publish-${id}`, async () => {
      await api.publishKnowhow(id);
      await loadAll();
      setTab('best');
      setMessage(aiReady ? 'Copilot によるベストプラクティス草案を作成しました。' : 'ローカル草案を作成しました。');
    });
  };

  const hasThemes = themes.length > 0;

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">知識を育てる、次の一歩をつなぐ</p>
          <h1>Know-how Vault</h1>
          <p className="hero-text">
            DB 登録を軸に、手動入力・自動収集・Copilot 分析をひとつの流れで扱えるようにしました。
          </p>
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
            <strong>{bestPractices.length}</strong>
            <span>ベストプラクティス</span>
          </div>
          <div className="stat-card">
            <strong>{sources.length}</strong>
            <span>自動収集ソース</span>
          </div>
          <div className="stat-card">
            <strong>{publishedCount}</strong>
            <span>公開済み</span>
          </div>
        </div>
      </header>

      {error && <div className="banner banner-error">{error}</div>}
      {message && <div className="banner banner-success">{message}</div>}
      {!error && !loading && (
        <div className="banner banner-info">
          {aiReady
            ? 'Copilot 連携が有効です。分析とベストプラクティス作成は GitHub Models を優先して実行します。'
            : 'Copilot トークン未設定のため、分析とベストプラクティスはローカル生成で補完しています。'}
        </div>
      )}

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
              <p>手動入力と自動収集の両方をここから扱います。</p>
            </div>
            <button onClick={() => void handleCreateTheme()} className="secondary" disabled={!backendReady || busyAction === 'create-theme'}>
              テーマを追加
            </button>
          </div>

          <div className="split-grid">
            <section className="subcard">
              <h3>手動で登録</h3>
              <p className="muted">個別の気づきやナレッジをその場で登録します。</p>
              <form onSubmit={handleSubmit} className="form-grid">
                <label className="field">
                  <span className="field-label">タイトル</span>
                  <input
                    placeholder="例: 障害対応メモの整理方法"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    disabled={!backendReady}
                  />
                </label>

                <label className="field">
                  <span className="field-label">テーマ</span>
                  <select
                    value={form.themeId}
                    onChange={(e) => setForm({ ...form, themeId: e.target.value })}
                    required
                    disabled={!backendReady || !hasThemes}
                  >
                    <option value="">テーマを選択</option>
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field field-wide">
                  <span className="field-label">内容</span>
                  <textarea
                    rows={6}
                    placeholder="背景、やったこと、結果、次に活かせる点を書いてください"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    required
                    disabled={!backendReady}
                  />
                </label>

                <label className="field">
                  <span className="field-label">参考リンク / 出典</span>
                  <input
                    placeholder="https://..."
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    disabled={!backendReady}
                  />
                </label>

                <label className="field">
                  <span className="field-label">重要度 (1〜5)</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={form.importance}
                    onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
                    disabled={!backendReady}
                  />
                </label>

                <button type="submit" disabled={!backendReady || !hasThemes || busyAction === 'create-knowhow'}>
                  DB に保存
                </button>
              </form>
            </section>

            <section className="subcard">
              <div className="inline-heading">
                <div>
                  <h3>自動収集ソース</h3>
                  <p className="muted">RSS / Atom を登録して、定期的にノウハウ候補を取り込みます。</p>
                </div>
                <button onClick={() => void handleCollectAllSources()} disabled={!backendReady || sources.length === 0 || busyAction === 'collect-all'}>
                  すべて収集
                </button>
              </div>

              <form onSubmit={handleAddSource} className="form-grid compact-grid">
                <label className="field">
                  <span className="field-label">ソース名</span>
                  <input
                    placeholder="例: GitHub Blog"
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                    required
                    disabled={!backendReady}
                  />
                </label>

                <label className="field">
                  <span className="field-label">RSS / Atom URL</span>
                  <input
                    placeholder="https://.../feed.xml"
                    value={sourceForm.url}
                    onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                    required
                    disabled={!backendReady}
                  />
                </label>

                <label className="field">
                  <span className="field-label">テーマ</span>
                  <select
                    value={sourceForm.themeId}
                    onChange={(e) => setSourceForm({ ...sourceForm, themeId: e.target.value })}
                    required
                    disabled={!backendReady || !hasThemes}
                  >
                    <option value="">テーマを選択</option>
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">種類</span>
                  <select
                    value={sourceForm.type}
                    onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                    disabled={!backendReady}
                  >
                    <option value="rss">RSS / Atom</option>
                  </select>
                </label>

                <button type="submit" disabled={!backendReady || !hasThemes || busyAction === 'create-source'}>
                  ソースを追加
                </button>
              </form>

              {sources.length === 0 ? (
                <div className="empty-state">まだ自動収集ソースがありません。RSS / Atom を登録すると、収集作業の手間を減らせます。</div>
              ) : (
                <ul className="list source-list">
                  {sources.map((source) => (
                    <li key={source.id} className="list-card">
                      <div className="list-card-header">
                        <strong>{source.name}</strong>
                        <span className="status-pill">{source.type}</span>
                      </div>
                      <div>テーマ: {source.theme?.name ?? '未設定'}</div>
                      <div className="truncate">URL: {source.url}</div>
                      <div>最終収集: {source.lastCollectedAt ? new Date(source.lastCollectedAt).toLocaleString() : '未実行'}</div>
                      {source.lastError && <div className="error-text">前回エラー: {source.lastError}</div>}
                      <div className="actions">
                        <button onClick={() => void handleCollectSource(source.id)} disabled={!backendReady || busyAction === `collect-${source.id}`}>
                          今すぐ収集
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </section>
      )}

      {tab === 'workflow' && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>ワークフロー</h2>
              <p>収集した内容を Copilot 分析→整理→ベストプラクティス化へ進めます。</p>
            </div>
          </div>
          {knowhow.length === 0 ? (
            <div className="empty-state">まだノウハウがありません。収集タブから追加するか、自動収集を実行してください。</div>
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
                  {item.source && (
                    <div>
                      出典: <a href={item.source} target="_blank" rel="noreferrer">{item.source}</a>
                    </div>
                  )}
                  <p>{item.content}</p>
                  {item.analysisSummary && (
                    <div className="analysis-box">
                      <strong>分析サマリー</strong>
                      <p>{item.analysisSummary}</p>
                      {item.analysisDetails && (
                        <>
                          <ul>
                            {item.analysisDetails.keyPoints.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                          <p className="muted">生成元: {item.analysisDetails.provider === 'copilot' ? 'Copilot' : 'ローカル補完'}</p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="actions">
                    <button onClick={() => void handleAnalyze(item.id)} disabled={!backendReady || busyAction === `analyze-${item.id}`}>
                      {aiReady ? 'Copilot分析' : '分析'}
                    </button>
                    <button onClick={() => void handleOrganize(item.id)} disabled={!backendReady || busyAction === `organize-${item.id}`}>
                      整理
                    </button>
                    <button onClick={() => void handlePublish(item.id)} disabled={!backendReady || busyAction === `publish-${item.id}`}>
                      {aiReady ? 'Copilotでベストプラクティス化' : 'ベストプラクティス化'}
                    </button>
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
              <p>再利用しやすい形でまとまった知見を一覧できます。</p>
            </div>
          </div>
          {bestPractices.length === 0 ? (
            <div className="empty-state">まだベストプラクティスがありません。ワークフローから作成してください。</div>
          ) : (
            <ul className="list">
              {bestPractices.map((practice) => (
                <li key={practice.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{practice.title}</strong>
                    <span className="status-pill">{practice.provider === 'copilot' ? 'copilot' : 'draft'}</span>
                  </div>
                  <div>{practice.summary}</div>
                  <pre className="practice-content">{practice.content}</pre>
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
