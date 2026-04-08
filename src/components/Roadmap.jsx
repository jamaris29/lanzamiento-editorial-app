import React, { useState, useEffect, useRef } from 'react';
import { Download, X, Lock, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import html2pdf from 'html2pdf.js';
import { useAppContext } from '../context/AppContext';
import { roadmapContent } from '../data/roadmapData';
import TaskAccordion from './TaskAccordion';
import SuccessControlBanner from './SuccessControlBanner';

const COUNTDOWN_DURATION = 12 * 60 * 60; // 12 hours in seconds

const getCountdownExpiry = () => {
  const stored = localStorage.getItem('pw_expiry_12h');
  if (stored) {
    const expiry = parseInt(stored, 10);
    if (expiry > Date.now()) return expiry;
  }
  const expiry = Date.now() + COUNTDOWN_DURATION * 1000;
  localStorage.setItem('pw_expiry_12h', expiry);
  return expiry;
};

const Roadmap = () => {
  const { lang, format, setFormat, completedTasks, isPremium, resetTasks } = useAppContext();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedWeeksLocal, setCompletedWeeksLocal] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [timeLeft, setTimeLeft] = useState(() => {
    const expiry = getCountdownExpiry();
    return Math.max(0, Math.round((expiry - Date.now()) / 1000));
  });
  const successShownRef = useRef(false);

  const getVisibleTasks = (tasks) =>
    tasks.filter(task => task.formats.includes(format) || task.formats.includes('Ambos'));

  // Confetti on week completion
  useEffect(() => {
    const newlyCompleted = [];
    roadmapContent.forEach(week => {
      const visibleTasks = getVisibleTasks(week.tasks);
      if (visibleTasks.length === 0) return;
      const allCompleted = visibleTasks.every(t => completedTasks[t.id]);
      if (allCompleted && !completedWeeksLocal.includes(week.weekId)) {
        newlyCompleted.push(week.weekId);
      }
    });
    if (newlyCompleted.length > 0) {
      confetti({
        particleCount: 200,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#059669', '#7c3aed', '#6366f1', '#10b981', '#a78bfa'],
        zIndex: 9999,
        disableForReducedMotion: true,
      });
      setCompletedWeeksLocal(prev => [...prev, ...newlyCompleted]);
    }
  }, [completedTasks, format, completedWeeksLocal]);

  // PDF export — premium only
  const handleExportPDF = () => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'font-family: Arial, sans-serif; padding: 24px; color: #1a1a2e; background: #fff;';

    const rWeeks = roadmapContent.filter(w => !w.isBonus);
    const tTotal = rWeeks.reduce((a, w) => a + getVisibleTasks(w.tasks).length, 0);
    const tDone = rWeeks.reduce((a, w) => a + getVisibleTasks(w.tasks).filter(tk => completedTasks[tk.id]).length, 0);
    const pct = tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0;

    let html = `
      <h1 style="text-align:center;color:#7c3aed;margin-bottom:4px;font-size:20px;">
        ${lang === 'es' ? '📚 Mapa de Lanzamiento Editorial — 10 Semanas' : '📚 Editorial Launch Roadmap — 10 Weeks'}
      </h1>
      <p style="text-align:center;color:#6b7280;margin-bottom:6px;font-size:13px;">
        ${lang === 'es' ? 'Progreso total' : 'Total progress'}: ${tDone}/${tTotal} (${pct}%)
      </p>
      <div style="background:#e5e7eb;border-radius:99px;height:10px;margin-bottom:24px;">
        <div style="background:#7c3aed;height:10px;border-radius:99px;width:${pct}%;"></div>
      </div>
    `;

    rWeeks.forEach(week => {
      const vTasks = getVisibleTasks(week.tasks);
      if (vTasks.length === 0) return;
      const wDone = vTasks.every(t => completedTasks[t.id]);
      const wCount = vTasks.filter(t => completedTasks[t.id]).length;
      html += `
        <div style="margin-bottom:18px;page-break-inside:avoid;">
          <h2 style="font-size:13px;font-weight:bold;margin:0 0 6px;padding:8px 12px;background:${wDone ? '#d1fae5' : '#f3f4f6'};border-radius:6px;color:${wDone ? '#065f46' : '#374151'};">
            ${week.title[lang]} &nbsp;<span style="font-weight:normal;font-size:11px;">(${wCount}/${vTasks.length})</span>${wDone ? ' ✓' : ''}
          </h2>
          <ul style="list-style:none;padding:0;margin:0;">
      `;
      vTasks.forEach(task => {
        const done = !!completedTasks[task.id];
        html += `
          <li style="display:flex;align-items:flex-start;gap:8px;padding:5px 4px;border-bottom:1px solid #f0f0f0;">
            <span style="flex-shrink:0;width:16px;height:16px;border-radius:3px;background:${done ? '#059669' : '#d1d5db'};display:inline-flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;margin-top:2px;">${done ? '✓' : ''}</span>
            <span style="font-size:12px;color:${done ? '#9ca3af' : '#111827'};text-decoration:${done ? 'line-through' : 'none'};"> ${task.title[lang]}</span>
          </li>
        `;
      });
      html += '</ul></div>';
    });

    pdfContainer.innerHTML = html;
    document.body.appendChild(pdfContainer);
    const opt = {
      margin: 10,
      filename: lang === 'es' ? 'Mapa-Lanzamiento-Editorial.pdf' : 'Book-Launch-Roadmap.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(pdfContainer).set(opt).save().then(() => {
      document.body.removeChild(pdfContainer);
    });
  };

  // Countdown timer — resets when it hits 0 so $27 price never changes
  useEffect(() => {
    if (!showPaywall) return;
    const timer = setInterval(() => {
      const expiry = getCountdownExpiry();
      const remaining = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      if (remaining === 0) {
        localStorage.removeItem('pw_expiry_12h');
        const newExpiry = Date.now() + COUNTDOWN_DURATION * 1000;
        localStorage.setItem('pw_expiry_12h', newExpiry);
        setTimeLeft(COUNTDOWN_DURATION);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [showPaywall]);

  const formatTime = (secs) => ({
    h: String(Math.floor(secs / 3600)).padStart(2, '0'),
    m: String(Math.floor((secs % 3600) / 60)).padStart(2, '0'),
    s: String(secs % 60).padStart(2, '0'),
  });

  const { h, m, s } = formatTime(timeLeft);

  const handlePaywallClick = () => setShowPaywall(true);
  const handleWeekClick = (week) => setSelectedWeek(week);
  const handleCloseModal = () => setSelectedWeek(null);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setSelectedWeek(null); setShowPaywall(false); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Lock body scroll when modal/paywall open
  useEffect(() => {
    document.body.style.overflow = (selectedWeek || showPaywall || showSuccessModal) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedWeek, showPaywall, showSuccessModal]);

  const t = {
    es: {
      roadmap: 'Tu Mapa de 10 Semanas',
      roadmapSub: 'Tu guía paso a paso para un lanzamiento que haga ruido',
      tasksOf: 'de',
      completed: 'completadas',
    },
    en: {
      roadmap: 'Your 10-Week Roadmap',
      roadmapSub: 'Your step-by-step guide to a launch that makes noise',
      tasksOf: 'of',
      completed: 'completed',
    }
  }[lang];

  const regularWeeks = roadmapContent.filter(w => !w.isBonus);
  const totalTasks = regularWeeks.reduce((acc, week) => acc + getVisibleTasks(week.tasks).length, 0);
  const totalCompleted = regularWeeks.reduce((acc, week) =>
    acc + getVisibleTasks(week.tasks).filter(tk => completedTasks[tk.id]).length, 0);
  const totalPercent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // Show success modal when 100% reached
  useEffect(() => {
    if (totalPercent === 100 && !successShownRef.current) {
      successShownRef.current = true;
      setShowSuccessModal(true);
    } else if (totalPercent < 100) {
      successShownRef.current = false;
    }
  }, [totalPercent]);

  const handleReset = () => {
    resetTasks();
    setShowSuccessModal(false);
    setCompletedWeeksLocal([]);
    successShownRef.current = false;
  };

  return (
    <div className="roadmap-container">

      {/* ── Hero header ── */}
      <div className="roadmap-hero">
        <h2 className="roadmap-hero-title">{t.roadmap}</h2>
        <p className="roadmap-hero-sub">{t.roadmapSub}</p>

        <div className="roadmap-hero-controls">
          <span className="format-badge">{lang === 'es' ? 'Formato' : 'Format'}: {format}</span>
          <button className="text-button" onClick={() => setFormat(null)}>
            {lang === 'es' ? 'Cambiar' : 'Change'}
          </button>
        </div>

        <div className="global-progress">
          <div className="global-progress-info">
            <span className="global-progress-label">{totalCompleted} {t.tasksOf} {totalTasks} {t.completed}</span>
            <span className="global-progress-percent">{totalPercent}%</span>
          </div>
          <div className="global-progress-track">
            <div className="global-progress-fill" style={{ width: `${totalPercent}%` }}></div>
          </div>
        </div>

        <button className="btn-primary roadmap-pdf-btn" onClick={handleExportPDF}>
          <Download size={18} />
          {isPremium
            ? (lang === 'es' ? 'Descargar Plan PDF' : 'Download PDF Plan')
            : (lang === 'es' ? '🔒 Descargar PDF — Solo Premium' : '🔒 Download PDF — Premium Only')}
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className="roadmap-timeline" id="roadmap-printable-area">
        {roadmapContent.map((week, index) => {
          const visibleTasks = getVisibleTasks(week.tasks);
          if (visibleTasks.length === 0) return null;

          const isBonus = week.isBonus === true;
          const isLocked = !week.isFree && !isPremium;
          const weekCompletedCount = visibleTasks.filter(tk => completedTasks[tk.id]).length;
          const weekTotalCount = visibleTasks.length;
          const weekPercent = weekTotalCount > 0 ? Math.round((weekCompletedCount / weekTotalCount) * 100) : 0;
          const isWeekDone = weekPercent === 100;
          const isLastWeek = index === roadmapContent.length - 1;

          return (
            <div
              key={`week-${week.weekId}`}
              className={`timeline-item ${isLocked && !isBonus ? 'timeline-item--locked' : ''} ${isWeekDone ? 'timeline-item--done' : ''}`}
            >
              {/* Track node + connector */}
              <div className="timeline-track-col">
                <div className={`timeline-node ${isBonus ? 'bonus-node' : ''} ${!isBonus && isWeekDone ? 'timeline-node--done' : ''} ${isLocked && !isBonus ? 'timeline-node--locked' : ''}`}>
                  {isBonus
                    ? <span style={{ fontSize: '0.9rem' }}>🎁</span>
                    : isWeekDone
                      ? <Check size={16} />
                      : <span className="timeline-node-number">{week.weekId}</span>}
                </div>
                {!isLastWeek && <div className={`timeline-connector ${isWeekDone ? 'timeline-connector--done' : ''}`}></div>}
              </div>

              {/* ── Bonus Card (Escudo del Autor) ── */}
              {isBonus ? (
                <section className="week-card week-card--bonus">
                  <div className="week-card-header">
                    <div className="bonus-badge">🎁 {lang === 'es' ? 'Bono Especial' : 'Special Bonus'}</div>
                    <div className="week-card-title-row">
                      <h3 className="week-title">{week.title[lang]}</h3>
                    </div>
                    {week.subtitle && <p className="week-subtitle">{week.subtitle[lang]}</p>}
                    <div style={{ marginTop: '0.75rem' }}>
                      {isPremium ? (
                        <a
                          href="https://el-escudo-del-autor.vercel.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{ fontSize: '0.9rem', padding: '0.65rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                        >
                          🛡️ {lang === 'es' ? 'Abrir El Escudo del Autor' : "Open The Author's Shield"}
                        </a>
                      ) : (
                        <button
                          className="btn-primary"
                          onClick={(e) => { e.stopPropagation(); handlePaywallClick(); }}
                          style={{ fontSize: '0.9rem', padding: '0.65rem 1.25rem' }}
                        >
                          🔒 {lang === 'es' ? 'Desbloquear Bono con Acceso Total' : 'Unlock Bonus with Full Access'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                /* ── Normal Week Card ── */
                <section
                  className={`week-card ${isLocked ? 'week-card--locked' : ''} ${isWeekDone ? 'week-card--done' : ''}`}
                  onClick={() => handleWeekClick(week)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleWeekClick(week); }}
                  style={{ cursor: 'pointer' }}
                >
                  {isLocked && week.weekId === 8 && (
                    <div className="week8-urgency-strip">
                      <span>⚡</span>
                      <span>
                        {lang === 'es'
                          ? 'Semanas 8→1 bloqueadas — Desbloquea ahora y empieza hoy.'
                          : 'Weeks 8→1 locked — Unlock now and start today.'}
                      </span>
                      <button className="week8-urgency-btn" onClick={(e) => { e.stopPropagation(); handlePaywallClick(); }}>
                        {lang === 'es' ? 'Ver oferta →' : 'See offer →'}
                      </button>
                    </div>
                  )}
                  <div className="week-card-header">
                    <div className="week-card-title-row">
                      <h3 className="week-title">{week.title[lang]}</h3>
                      {isLocked
                        ? <Lock size={16} style={{ color: 'var(--violet)', flexShrink: 0 }} />
                        : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {lang === 'es' ? 'Ver tareas →' : 'View tasks →'}
                          </span>}
                    </div>
                    {week.subtitle && <p className="week-subtitle">{week.subtitle[lang]}</p>}
                    {!isLocked && (
                      <div className="week-progress">
                        <div className="week-progress-info">
                          <span>{weekCompletedCount} {t.tasksOf} {weekTotalCount}</span>
                          <span>{weekPercent}%</span>
                        </div>
                        <div className="week-progress-track">
                          <div className="week-progress-fill" style={{ width: `${weekPercent}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================
         Centered Week Modal
         ============================ */}
      {selectedWeek && (() => {
        const isLocked = !selectedWeek.isFree && !isPremium;
        const visibleTasks = getVisibleTasks(selectedWeek.tasks);
        const weekCompletedCount = visibleTasks.filter(tk => completedTasks[tk.id]).length;
        const weekPercent = visibleTasks.length > 0
          ? Math.round((weekCompletedCount / visibleTasks.length) * 100) : 0;

        return (
          <div className="week-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
            <div className="week-modal">
              {/* Modal header */}
              <div className="week-modal-header">
                <div className="week-modal-header-info">
                  <span className="slide-over-week-label">
                    {lang === 'es' ? `Semana ${selectedWeek.weekId}` : `Week ${selectedWeek.weekId}`}
                    {isLocked && <span className="modal-locked-badge">🔒 Premium</span>}
                  </span>
                  <h3 className="slide-over-title">{selectedWeek.title[lang]}</h3>
                  {selectedWeek.subtitle && (
                    <p className="slide-over-subtitle">{selectedWeek.subtitle[lang]}</p>
                  )}
                </div>
                <button className="slide-over-close" onClick={handleCloseModal}><X size={20} /></button>
              </div>

              {/* Progress bar — only for unlocked weeks */}
              {!isLocked && (
                <div className="slide-over-progress">
                  <div className="slide-over-progress-info">
                    <span>{weekCompletedCount} {t.tasksOf} {visibleTasks.length} {t.completed}</span>
                    <span>{weekPercent}%</span>
                  </div>
                  <div className="slide-over-progress-track">
                    <div className="slide-over-progress-fill" style={{ width: `${weekPercent}%` }}></div>
                  </div>
                </div>
              )}

              {/* Modal body */}
              <div className="week-modal-body">
                {isLocked ? (
                  <div className="modal-locked-content">
                    <div className="modal-locked-preview">
                      {visibleTasks.slice(0, 3).map(task => (
                        <div key={task.id} className="modal-task-preview-item">
                          <span className="modal-task-preview-icon">📌</span>
                          <span className="modal-task-preview-title">{task.title[lang]}</span>
                        </div>
                      ))}
                      {visibleTasks.length > 3 && (
                        <p className="modal-locked-more">
                          + {visibleTasks.length - 3} {lang === 'es' ? 'tareas más...' : 'more tasks...'}
                        </p>
                      )}
                    </div>
                    <div className="modal-locked-cta">
                      <div className="modal-locked-icon">🔒</div>
                      <h4>{lang === 'es' ? 'Contenido Premium' : 'Premium Content'}</h4>
                      <p>{lang === 'es'
                        ? 'Desbloquea el plan completo de 10 semanas por un único pago de $27.'
                        : 'Unlock the full 10-week plan for a one-time payment of $27.'}</p>
                      <button className="btn-primary" onClick={() => { handleCloseModal(); handlePaywallClick(); }}>
                        💎 {lang === 'es' ? 'Desbloquear por $27' : 'Unlock for $27'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="slide-over-tasks-list">
                    {visibleTasks.map(task => (
                      <TaskAccordion
                        key={task.id}
                        task={task}
                        isLocked={false}
                        onPaywallClick={handlePaywallClick}
                      />
                    ))}
                    {selectedWeek.weekId === 9 && <SuccessControlBanner />}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================
         Success Modal — 100% Complete
         ============================ */}
      {showSuccessModal && (
        <div className="success-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSuccessModal(false); }}>
          <div className="success-modal">
            <div className="success-modal-confetti">🎉</div>
            <h2 className="success-modal-title">
              {lang === 'es' ? '🎉 ¡Misión Cumplida!' : '🎉 Mission Accomplished!'}
            </h2>
            <p className="success-modal-body">
              {lang === 'es'
                ? 'Has completado el 100% de tu plan de lanzamiento. Escribir un libro es un acto de valentía, pero organizarte para lanzarlo como un profesional es lo que marca la diferencia. ¡Te deseamos muchísimo éxito y ventas en este gran día!'
                : "You've completed 100% of your launch plan. Writing a book is an act of courage, but organizing to launch it like a professional is what makes the difference. We wish you tremendous success and sales on this big day!"}
            </p>
            <p className="success-modal-question">
              {lang === 'es' ? '¿Listo para tu próxima aventura literaria? 📖' : 'Ready for your next literary adventure? 📖'}
            </p>
            <button className="success-modal-reset-btn" onClick={handleReset}>
              🔄 {lang === 'es' ? 'Reiniciar el mapa desde cero' : 'Reset the map from scratch'}
            </button>
          </div>
        </div>
      )}

      {/* ============================
         Paywall Modal — 12h countdown
         ============================ */}
      {showPaywall && (
        <div className="paywall-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPaywall(false)}>
          <div className="paywall-modal paywall-modal--urgent">
            <span className="pw-urgency-badge">
              {lang === 'es' ? '⚡ Oferta por tiempo limitado' : '⚡ Limited time offer'}
            </span>
            <h3 className="modal-title">
              {lang === 'es' ? 'Tu libro merece llegar más lejos 📖' : 'Your book deserves to go further 📖'}
            </h3>
            <p className="pw-empathy">
              {lang === 'es'
                ? 'Todos los autores que publican sin un plan dejan dinero y lectores sobre la mesa. Tú ya diste el primer paso — el siguiente es tomar las riendas de tu lanzamiento.'
                : "Every author who publishes without a plan leaves money and readers on the table. You've already started — take control of your launch."}
            </p>

            <div className="pw-countdown-wrap">
              <p className="pw-countdown-label">
                {lang === 'es' ? '🔥 Este precio sube en' : '🔥 This price increases in'}
              </p>
              <div className="pw-countdown">
                <div className="pw-time-block">
                  <span className="pw-time-digit">{h}</span>
                  <span className="pw-time-unit">hrs</span>
                </div>
                <span className="pw-time-sep">:</span>
                <div className="pw-time-block">
                  <span className="pw-time-digit">{m}</span>
                  <span className="pw-time-unit">min</span>
                </div>
                <span className="pw-time-sep">:</span>
                <div className="pw-time-block">
                  <span className="pw-time-digit">{s}</span>
                  <span className="pw-time-unit">{lang === 'es' ? 'seg' : 'sec'}</span>
                </div>
              </div>
              <p className="pw-countdown-sub">
                {lang === 'es'
                  ? 'Después de este tiempo, el precio será $49. Hoy solo $27.'
                  : 'After this time, the price will be $49. Today only $27.'}
              </p>
            </div>

            <div className="modal-actions">
              <a href="https://buy.stripe.com/8x27sMcmHcdu6IZ37R4c802" target="_blank" rel="noreferrer" className="btn-primary mockup-btn pw-cta-btn">
                {lang === 'es' ? '🚀 Desbloquear Plan Completo por $27' : '🚀 Unlock Full Plan for $27'}
              </a>
              <button className="text-button" onClick={() => setShowPaywall(false)}>
                {lang === 'es' ? 'Seguir explorando gratis' : 'Keep exploring for free'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roadmap;
