import { useEffect, useRef, useState } from 'react';
import type { LocalData, PublicTest, TestResult } from '@prostir/contracts';
import Landing from './Landing';
import { readStorage, storageKey } from './storage';

type View = 'intro' | 'question' | 'result' | 'history' | 'privacy' | 'clear' | null;
const options = ['Зовсім не відповідає','Радше не відповідає','Частково відповідає','Радше відповідає','Повністю відповідає'];
export default function App() {
  const [tests, setTests] = useState<PublicTest[]>([]);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<LocalData>(readStorage);
  const [storageOk, setStorageOk] = useState(true);
  const [view, setView] = useState<View>(null);
  const [active, setActive] = useState<PublicTest | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/tests', { signal: abort.signal }).then(async r => {
      if (!r.ok) throw Error();
      setTests(await r.json());
    }).catch(e => { if (e.name !== 'AbortError') setLoadError('Не вдалося завантажити каталог. Перевірте, чи запущено backend.'); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); setStorageOk(true); }
    catch { setStorageOk(false); }
  }, [data]);
  useEffect(() => {
    if (view && !dialog.current?.open) dialog.current?.showModal();
    if (!view && dialog.current?.open) dialog.current.close();
  }, [view]);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if (view === 'question' && !busy && /^[1-5]$/.test(e.key)) {
        e.preventDefault(); choose(Number(e.key)); nextButton.current?.focus();
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  });
  function open(id: string) {
    const test = tests.find(t => t.id === id);
    if (!test) return;
    setActive(test); setError(''); setView('intro');
  }
  function persist(values: number[], at: number) {
    if (!active) return;
    setData(prev => ({ ...prev, drafts: { ...prev.drafts, [active.id]: { answers: values, index: at } } }));
  }
  function choose(value: number) {
    const values = [...answers]; values[index] = value;
    setAnswers(values); persist(values, index); setError('');
  }
  function begin() {
    if (!active) return;
    const draft = data.drafts[active.id];
    const values = Array.isArray(draft?.answers) ? draft.answers.slice(0, active.questions.length).map(v => Number.isInteger(v) && v >= 1 && v <= 5 ? v : 0) : [];
    const at = Number.isInteger(draft?.index) ? Math.max(0, Math.min(draft.index, active.questions.length - 1)) : 0;
    setAnswers(values); setIndex(at); setView('question');
  }
  async function next() {
    if (!active || !answers[index] || submitting.current) return;
    if (index < active.questions.length - 1) {
      setIndex(index + 1); persist(answers, index + 1); return;
    }
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/tests/' + active.id + '/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, version: active.version }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw Error(payload.message || 'Не вдалося обчислити результат.');
      }
      const value: TestResult = await response.json();
      setData(prev => {
        const drafts = { ...prev.drafts }; delete drafts[active.id];
        return { history: [value, ...prev.history], drafts };
      });
      setResult(value); setView('result');
    } catch (e) { setError(e instanceof Error ? e.message : 'Перевірте з’єднання та спробуйте ще раз.'); }
    finally { setBusy(false); submitting.current = false; }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...result, title: tests.find(t => t.id === result.id)?.title, notice: 'Демонстраційне опитування без діагностичних норм' }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'prostir-result.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const found = tests.filter(t => (filter === 'all' || t.category === filter) && (t.title + ' ' + t.desc + ' ' + t.label).toLocaleLowerCase('uk').includes(query.toLocaleLowerCase('uk')));
  return <>
    <Landing onStart={() => open('balance')} onHistory={() => setView('history')} onPrivacy={() => setView('privacy')}>
      <div className="toolbar"><div className="filters">{[['all','Усі теми'],['Емоції','Емоції та стрес'],['Особистість','Особистість'],['Кар’єра','Кар’єра'],['Стосунки','Стосунки']].map(([id,label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук опитування…" aria-label="Пошук опитування"/></div>
      {loadError && <p role="alert">{loadError} <button className="outline" onClick={() => location.reload()}>Повторити</button></p>}
      <div className="cards">{found.map(t => <article className="card" key={t.id}><div className="card-art"><span className="card-badge">Демо · безкоштовно</span><div className="shape"/></div><div className="card-content"><div className="meta">{t.label}</div><h3>{t.title}</h3><p>{t.desc}</p><div className="card-bottom"><span>◷ 2–3 хв · {t.questions.length} запитань</span><button onClick={() => open(t.id)}>Почати ↗</button></div></div></article>)}{!loadError && !found.length && <p className="empty">{tests.length ? 'За цим запитом опитувань немає.' : 'Завантаження каталогу…'}</p>}</div>
    </Landing>
    <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else setView(null); }} onClose={() => setView(null)} aria-label="Особистий простір">
      <button className="close" aria-label="Закрити" disabled={busy} onClick={() => setView(null)}>×</button>
      {view === 'intro' && active && <><div className="eyebrow">ПЕРШИЙ КРОК ДО СЕБЕ</div><h2>{active.title}</h2><p>Подумайте про останні 7 днів. Оцініть, наскільки кожне твердження відповідає вашому досвіду.</p><p className="small">Це авторське демонстраційне опитування. Воно не є валідованою психологічною методикою та не встановлює діагнозів.</p><p className="small">Після завершення відповіді передаються на сервер для обрахунку. Сервер не записує відповіді та результати в базу. Чернетки й історія зберігаються у цьому браузері.</p><button className="primary" onClick={begin}>{data.drafts[active.id] ? 'Продовжити опитування' : 'Почати опитування'} →</button></>}
      {view === 'question' && active && <><div className="eyebrow">{active.title}</div><progress value={answers.filter(v => v >= 1 && v <= 5).length} max={active.questions.length}/><p className="small">Запитання {index + 1} з {active.questions.length} · {storageOk ? 'Прогрес збережено на пристрої' : 'Збереження недоступне'}</p><h2>{active.questions[index]}</h2><div className="answers">{options.map((label,i) => <button key={label} disabled={busy} className={'answer ' + (answers[index] === i + 1 ? 'selected' : '')} aria-pressed={answers[index] === i + 1} onClick={() => choose(i + 1)}>{i + 1}. {label}</button>)}</div>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button className="outline" disabled={!index || busy} onClick={() => {setIndex(index - 1); persist(answers,index - 1);}}>← Назад</button><span className="small">Клавіші 1–5</span><button ref={nextButton} className="primary" disabled={!answers[index] || busy} onClick={next}>{busy ? 'Обчислюємо…' : index === active.questions.length - 1 ? 'Мій результат' : 'Далі →'}</button></div></>}
      {view === 'result' && result && <><div className="eyebrow">ПІДСУМОК ВАШИХ ВІДПОВІДЕЙ</div><h2>{tests.find(t => t.id === result.id)?.title || 'Опитування'}</h2><div className="score">{result.percent}<small> / 100</small></div><p>Ваші відповіді відповідають {result.raw} балам. Після врахування зворотних тверджень результат переведено у шкалу 0–100.</p><p className="small">Вищий показник означає більшу згоду з твердженнями про доступні ресурси. Для цієї демонстрації немає клінічних порогів або нормативів.</p><p>Що з описаного вже підтримує вас, а чому хочеться приділити більше уваги?</p><p className="small">{storageOk ? 'Історію збережено лише в цьому браузері.' : 'Не вдалося зберегти історію. Завантажте результат.'}</p><div className="dialog-actions"><button className="outline" onClick={download}>Завантажити JSON ↓</button><button className="primary" onClick={() => setView('history')}>Моя історія →</button></div></>}
      {view === 'history' && <><div className="eyebrow">МІЙ ПРОСТІР</div><h2>Історія результатів</h2><p className="small">Цей пристрій · без облікового запису · {data.history.length} проходжень</p>{data.history.map((r,i) => <div className="history-item" key={r.date + i}><div><strong>{tests.find(t => t.id === r.id)?.title || 'Опитування'}</strong><br/><span className="small">{new Date(r.date).toLocaleString('uk-UA')}</span></div><button className="outline" onClick={() => {setResult(r);setView('result');}}>{r.percent} / 100 ↗</button></div>)}{!data.history.length && <p>Тут з’являться ваші завершені опитування.</p>}{(data.history.length > 0 || Object.keys(data.drafts).length > 0) && <p><button className="text small" onClick={() => setView('clear')}>Видалити історію та чернетки з пристрою</button></p>}</>}
      {view === 'clear' && <><h2>Видалити всі локальні дані?</h2><p>Історія та незавершені відповіді будуть видалені з цього браузера.</p><div className="dialog-actions"><button className="outline" onClick={() => setView('history')}>Залишити дані</button><button className="primary" onClick={() => {setData({history:[],drafts:{}});setView('history');}}>Видалити</button></div></>}
      {view === 'privacy' && <><h2>Ваші дані та приватність</h2><p>Чернетки й історія зберігаються локально у браузері. Для обрахунку відповіді передаються на сервер без облікового запису й не записуються в базу даних. MongoDB зберігає каталог демонстраційних опитувань.</p><p>Видалити локальні дані можна в розділі «Мої результати». Очищення браузера видалить історію. На спільному пристрої інші користувачі можуть бачити ваші результати.</p><p className="small">Шрифт завантажується з Google Fonts. Хостинг обробляє технічні запити відвідування. Авторизація та платежі ще не підключені.</p></>}
    </dialog>
  </>;
}
