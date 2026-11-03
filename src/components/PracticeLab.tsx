import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  RefreshCw,
  Shuffle,
  Target,
  Trophy,
} from 'lucide-react'
import { MathBlock } from '@/components/Math'
import { PracticeGraph } from '@/components/PracticeGraph'
import {
  generatePracticeTask,
  PRACTICE_LEVELS,
  practiceSources,
  type PracticeLevel,
} from '@/data/practiceGenerators'
import { TOPICS, type Topic } from '@/data/tasks'
import { normalizeAnswer } from '@/utils/normalizeAnswer'

const GENERATED_STORAGE_KEY = 'retake-trainer-generated-v1'
type Feedback = 'idle' | 'correct' | 'wrong' | 'empty'

function readGeneratedSolved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GENERATED_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const sourceIds = new Set(practiceSources.map((task) => task.id))
    return parsed.filter((key): key is string => {
      if (typeof key !== 'string') return false
      const match = /^generated-(v[12]-\d{2})-(base|retake|challenge)-(\d+)$/.exec(key)
      return Boolean(match && sourceIds.has(match[1]))
    })
  } catch {
    return []
  }
}

function hasSolved(keys: string[], sourceId: string, level: PracticeLevel) {
  return keys.some((key) => key.startsWith(`generated-${sourceId}-${level}-`))
}

function newSeed(except?: number) {
  let seed = Math.floor(Math.random() * 899999) + 100000
  if (seed === except) seed += 1
  return seed
}

export function PracticeLab() {
  const [task, setTask] = useState(() => generatePracticeTask('v1-01', 'base', 104729))
  const [solvedKeys, setSolvedKeys] = useState<string[]>(readGeneratedSolved)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintOpen, setHintOpen] = useState(false)
  const [solutionOpen, setSolutionOpen] = useState(false)
  const [streak, setStreak] = useState(0)
  const solvedSet = useMemo(() => new Set(solvedKeys), [solvedKeys])
  const source = practiceSources.find((item) => item.id === task.sourceId) ?? practiceSources[0]
  const topicSources = practiceSources.filter((item) => item.topic === source.topic)
  const currentLevel = PRACTICE_LEVELS.find((item) => item.id === task.level) ?? PRACTICE_LEVELS[0]

  const isMastered = (sourceId: string) => PRACTICE_LEVELS.every((level) => hasSolved(solvedKeys, sourceId, level.id))
  const masteredTotal = practiceSources.filter((item) => isMastered(item.id)).length
  const clearedLevels = practiceSources.reduce(
    (total, item) => total + PRACTICE_LEVELS.filter((level) => hasSolved(solvedKeys, item.id, level.id)).length,
    0,
  )
  const masteryPercent = Math.round((clearedLevels / (practiceSources.length * PRACTICE_LEVELS.length)) * 100)
  const currentSolved = solvedSet.has(task.id)
  const currentSourceMastered = isMastered(task.sourceId)
  const levelVariantCount = solvedKeys.filter((key) => key.startsWith(`generated-${task.sourceId}-${task.level}-`)).length

  useEffect(() => {
    localStorage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(solvedKeys))
  }, [solvedKeys])

  useEffect(() => {
    const reset = () => {
      setSolvedKeys([])
      setStreak(0)
    }
    window.addEventListener('retake-reset', reset)
    return () => window.removeEventListener('retake-reset', reset)
  }, [])

  const openTask = (sourceId: string, level: PracticeLevel, seed = newSeed(task.seed)) => {
    setTask(generatePracticeTask(sourceId, level, seed))
    setAnswer('')
    setFeedback('idle')
    setHintOpen(false)
    setSolutionOpen(false)
  }

  const chooseTopic = (topic: Topic) => {
    const next = practiceSources.find((item) => item.topic === topic)
    if (next) openTask(next.id, task.level)
  }

  const checkAnswer = (event: React.FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) {
      setFeedback('empty')
      return
    }
    const normalized = normalizeAnswer(answer)
    const isCorrect = task.accepted.some((item) => normalizeAnswer(item) === normalized)
    setFeedback(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) {
      setSolvedKeys((previous) => previous.includes(task.id) ? previous : [...previous, task.id])
      setStreak((previous) => previous + 1)
    } else {
      setStreak(0)
    }
  }

  return (
    <section id="practice" className="practice-section" aria-labelledby="practice-title">
      <div className="practice-heading">
        <div>
          <p className="section-label">Тренировка темы</p>
          <h2 id="practice-title">Один метод.<br />Всегда новые числа.</h2>
        </div>
        <div className="practice-heading-copy">
          <p>Здесь нельзя запомнить ответ вместо решения. Каждый новый вариант меняет параметры, а разбор пересчитывается вместе с ними.</p>
          <div className="mastery-summary">
            <div><strong>{masteredTotal}/40</strong><span>типов освоено</span></div>
            <div className="mastery-track" aria-label={`Освоение: ${masteryPercent}%`}><span style={{ width: `${masteryPercent}%` }} /></div>
            <small>{clearedLevels}/120 уровней закрыто · прогресс сохраняется в этом браузере</small>
          </div>
        </div>
      </div>

      <div className="practice-rule">
        <Trophy size={22} aria-hidden="true" />
        <p><strong>Как освоить тип:</strong> реши верно хотя бы по одному варианту на уровнях «База», «Пересдача» и «Усложнение». Повтор того же варианта не накручивает прогресс.</p>
      </div>

      <div className="practice-layout">
        <aside className="practice-topic-panel" aria-label="Темы для тренировки">
          <span className="practice-panel-label">Выбери тему</span>
          <div className="practice-topic-list">
            {TOPICS.map((topic) => {
              const sources = practiceSources.filter((item) => item.topic === topic)
              const mastered = sources.filter((item) => isMastered(item.id)).length
              return (
                <button
                  type="button"
                  key={topic}
                  className={source.topic === topic ? 'active' : ''}
                  aria-pressed={source.topic === topic}
                  onClick={() => chooseTopic(topic)}
                >
                  <span>{topic}</span>
                  <small>{mastered}/{sources.length}</small>
                </button>
              )
            })}
          </div>
          <p className="practice-topic-note">Счётчик показывает полностью освоенные типы, а не число нажатий.</p>
        </aside>

        <article className="practice-workspace" aria-labelledby="generated-task-title">
          <div className="practice-controls">
            <label htmlFor="practice-source">Тип задачи</label>
            <select id="practice-source" value={task.sourceId} onChange={(event) => openTask(event.target.value, task.level)}>
              {topicSources.map((item) => (
                <option key={item.id} value={item.id}>Вариант {item.variant} · задание {item.number}</option>
              ))}
            </select>
            <div className="practice-levels" aria-label="Уровень сложности">
              {PRACTICE_LEVELS.map((level) => {
                const cleared = hasSolved(solvedKeys, task.sourceId, level.id)
                return (
                  <button
                    type="button"
                    key={level.id}
                    className={task.level === level.id ? 'active' : ''}
                    aria-pressed={task.level === level.id}
                    onClick={() => openTask(task.sourceId, level.id)}
                  >
                    <span>{level.label}</span>
                    {cleared && <Check size={15} aria-label="Уровень пройден" />}
                  </button>
                )
              })}
            </div>
            <p className="practice-level-description">{currentLevel.description}</p>
          </div>

          <div className="generated-task">
            <div className="task-meta">
              <span>Вариант {source.variant} / тип {source.number}</span>
              <span>№ {task.seed}</span>
            </div>
            <div className="task-topic">Новый вариант · {task.topic}</div>
            <h3 id="generated-task-title">{task.prompt}</h3>
            {task.math && <MathBlock className="task-formula">{task.math}</MathBlock>}
            {task.graphSpec && <PracticeGraph spec={task.graphSpec} />}

            <form className="answer-form" onSubmit={checkAnswer}>
              <label htmlFor="practice-answer-input">Твой ответ</label>
              <div className="answer-row">
                <input
                  id="practice-answer-input"
                  value={answer}
                  onChange={(event) => { setAnswer(event.target.value); if (feedback !== 'idle') setFeedback('idle') }}
                  placeholder={task.placeholder}
                  autoComplete="off"
                  aria-describedby="practice-answer-format practice-answer-feedback"
                />
                <button type="submit" className="check-button">Проверить <ArrowRight size={18} aria-hidden="true" /></button>
              </div>
              <p id="practice-answer-format" className="format-note">Можно писать sqrt(2), pi, inf и U вместо ∪. Обычную дробь вводи через /.</p>
            </form>

            <div id="practice-answer-feedback" className="feedback-region" aria-live="polite">
              {feedback === 'correct' && (
                <div className="feedback correct-feedback">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  <div>
                    <strong>{currentSourceMastered ? 'Верно. Весь тип освоен!' : 'Верно. Метод работает на новых числах.'}</strong>
                    <p>{streak >= 3 ? `Серия: ${streak} верных ответа подряд.` : 'Теперь смени числа или перейди на следующий уровень.'}</p>
                  </div>
                </div>
              )}
              {feedback === 'wrong' && (
                <div className="feedback wrong-feedback">
                  <Target size={24} aria-hidden="true" />
                  <div><strong>Пока не сходится. Разбери метод, не числа.</strong><p>{task.mistake}</p></div>
                </div>
              )}
              {feedback === 'empty' && <p className="empty-feedback">Сначала запиши ответ. Если не получается, открой подсказку ниже.</p>}
            </div>

            <div className="help-actions">
              <button type="button" onClick={() => setHintOpen((value) => !value)} aria-expanded={hintOpen} aria-controls="practice-task-hint">
                <Lightbulb size={19} aria-hidden="true" /> {hintOpen ? 'Скрыть подсказку' : 'Дать подсказку'}
              </button>
              <button type="button" onClick={() => setSolutionOpen((value) => !value)} aria-expanded={solutionOpen} aria-controls="practice-task-solution">
                <CircleHelp size={19} aria-hidden="true" /> {solutionOpen ? 'Скрыть разбор' : 'Показать разбор'}
              </button>
              <button type="button" className="similar-task-button" onClick={() => openTask(task.sourceId, task.level)}>
                <Shuffle size={19} aria-hidden="true" /> Сменить числа
              </button>
            </div>

            {hintOpen && (
              <div id="practice-task-hint" className="hint-panel">
                <span>Подсказка, не ответ</span>
                <p>{task.hint}</p>
              </div>
            )}

            {solutionOpen && (
              <div id="practice-task-solution" className="solution-panel">
                <div className="solution-heading"><span>Разбор этого варианта</span><RefreshCw size={20} aria-hidden="true" /></div>
                <ol>
                  {task.steps.map((step, index) => (
                    <li key={`${task.id}-${index}`}>
                      <span>{index + 1}</span>
                      <div><p>{step.text}</p>{step.math && <MathBlock>{step.math}</MathBlock>}</div>
                    </li>
                  ))}
                </ol>
                <div className="solution-answer"><strong>Ответ</strong><MathBlock>{task.answer}</MathBlock></div>
                <p className="mistake-note"><strong>На что обратить внимание:</strong> {task.mistake}</p>
              </div>
            )}

            <div className="generated-progress">
              <div className="generated-level-dots" aria-label="Прогресс по трём уровням">
                {PRACTICE_LEVELS.map((level) => (
                  <span key={level.id} className={hasSolved(solvedKeys, task.sourceId, level.id) ? 'done' : ''}>
                    {hasSolved(solvedKeys, task.sourceId, level.id) ? <Check size={14} aria-hidden="true" /> : null}{level.label}
                  </span>
                ))}
              </div>
              <p>{currentSourceMastered ? 'Тип освоен на всех уровнях. Можно возвращаться для повторения.' : `На этом уровне решено вариантов: ${levelVariantCount}. До освоения типа закрой все три уровня.`}</p>
            </div>

            <div className="task-footer">
              <span>{currentSolved ? <><Check size={17} aria-hidden="true" /> Этот вариант уже засчитан</> : 'Каждый вариант засчитывается только один раз'}</span>
              <button type="button" onClick={() => openTask(task.sourceId, task.level)}>Ещё вариант <ChevronRight size={19} aria-hidden="true" /></button>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
