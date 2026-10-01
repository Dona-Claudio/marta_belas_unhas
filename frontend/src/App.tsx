import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowRight, Bell, CalendarDays, Check, Heart, Instagram, LogOut, Menu, Scissors, Sparkles, Star, X } from 'lucide-react'
import { api } from './api'
import type { Appointment, PortfolioPost, Service, User } from './types'

type AuthMode = 'login' | 'register' | null

const statusLabels: Record<Appointment['status'], string> = {
  pending: 'Aguardando confirmação',
  approved: 'Confirmado',
  alternative_proposed: 'Novo horário sugerido',
  rejected: 'Não aprovado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

function formatDate(value: string | null) {
  if (!value) return 'A combinar'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T')))
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [portfolioPosts, setPortfolioPosts] = useState<PortfolioPost[]>([])
  const [reminders, setReminders] = useState<string[]>([])
  const [authMode, setAuthMode] = useState<AuthMode>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [proposingId, setProposingId] = useState<number | null>(null)

  useEffect(() => {
    api.services().then(({ services: items }) => setServices(items)).catch(() => setServices([]))
    if (localStorage.getItem('marta-nails-token')) {
      api.me().then(({ user: current }) => setUser(current)).catch(() => {
        api.logout()
        api.portfolio().then(({ posts }) => setPortfolioPosts(posts)).catch(() => setPortfolioPosts([]))
      })
    }
  }, [])

  useEffect(() => {
    api.portfolio().then(({ posts }) => setPortfolioPosts(posts)).catch(() => setPortfolioPosts([]))
  }, [user])

  useEffect(() => {
    if (!user) {
      setAppointments([])
      return
    }
    Promise.all([api.appointments(), api.notifications()]).then(([{ appointments: items }, { notifications }]) => {
      setAppointments(items)
      setReminders(notifications.map((notification) => notification.message))
      if ('Notification' in window && Notification.permission === 'granted') {
        notifications.forEach((notification) => new Notification('Lembrete de atendimento', { body: notification.message }))
      }
    }).catch((problem: Error) => setError(problem.message))
  }, [user])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      const current = authMode === 'register'
        ? await api.register({ name: String(data.get('name')), email: String(data.get('email')), phone: String(data.get('phone')), password: String(data.get('password')) })
        : await api.login(String(data.get('email')), String(data.get('password')))
      setUser(current)
      setAuthMode(null)
      setShowAccount(true)
      setMessage(`Bem-vinda, ${current.name.split(' ')[0]}.`)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      await api.createAppointment({ service_id: Number(data.get('service_id')), requested_at: String(data.get('requested_at')), description: String(data.get('description')) })
      const { appointments: items } = await api.appointments()
      setAppointments(items)
      setMessage('Pedido enviado. Você verá a confirmação por aqui.')
      form.reset()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível solicitar o horário.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePortfolioPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await api.createPortfolioPost({ title: String(data.get('title')), caption: String(data.get('caption')), media_url: String(data.get('media_url')), media_type: data.get('media_type') === 'video' ? 'video' : 'image' })
      const { posts } = await api.portfolio()
      setPortfolioPosts(posts)
      form.reset()
      setMessage('Trabalho publicado no portfólio.')
      setError('')
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível publicar o trabalho.')
    }
  }

  async function handleLike(postId: number) {
    if (!user) {
      setAuthMode('login')
      setError('Entre na sua conta para curtir os trabalhos.')
      return
    }
    if (user.role !== 'client') return
    try {
      const result = await api.toggleLike(postId)
      setPortfolioPosts((posts) => posts.map((post) => post.id === postId ? { ...post, liked_by_me: result.liked, like_count: result.like_count } : post))
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível registrar sua curtida.')
    }
  }

  async function updateAppointment(id: number, status: string, proposed_at?: string) {
    try {
      await api.updateAppointment(id, { status, proposed_at })
      const { appointments: items } = await api.appointments()
      setAppointments(items)
      setProposingId(null)
      setMessage('Agenda atualizada.')
      setError('')
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível atualizar o pedido.')
    }
  }

  async function submitAlternative(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await updateAppointment(id, 'alternative_proposed', String(data.get('proposed_at')))
  }

  async function submitReview(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await api.review(id, { rating: Number(data.get('rating')), comment: String(data.get('comment')) })
      const { appointments: items } = await api.appointments()
      setAppointments(items)
      setReviewingId(null)
      setMessage('Obrigada por compartilhar sua avaliação.')
      setError('')
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível enviar sua avaliação.')
    }
  }

  function requestReminderPermission() {
    if (!('Notification' in window)) {
      setMessage('Este navegador não oferece notificações. Consulte sua agenda aqui ou fale pelo Instagram.')
      return
    }
    Notification.requestPermission().then((permission) => {
      setMessage(permission === 'granted' ? 'Notificações ativadas neste navegador.' : 'Você pode ativar as notificações nas configurações do navegador.')
      if (permission === 'granted') reminders.forEach((reminder) => new Notification('Lembrete de atendimento', { body: reminder }))
    })
  }

  function signOut() {
    api.logout()
    setUser(null)
    setShowAccount(false)
    setMessage('Você saiu da sua conta.')
  }

  const isManicure = user?.role === 'manicure'

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Marta Dona Sousa, início">
          <span className="brand-mark"><Scissors size={18} strokeWidth={1.6} /></span>
          <span><strong>MARTA DONA SOUSA</strong><small>NAIL DESIGNER</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#servicos">Serviços</a><a href="#portfolio">Portfólio</a><a href="#sobre">Sobre</a>
        </nav>
        <div className="header-actions">
          {user ? <button className="button button-quiet account-trigger" onClick={() => setShowAccount((value) => !value)}><CalendarDays size={16} /> Minha agenda</button> : <button className="button button-quiet login-trigger" onClick={() => setAuthMode('login')}>Entrar</button>}
          <button className="button button-dark header-book" onClick={() => user ? setShowAccount(true) : setAuthMode('register')}>Agendar <ArrowRight size={15} /></button>
          <a className="mobile-menu" href="#servicos" aria-label="Ir para serviços"><Menu size={20} /></a>
        </div>
      </header>

      {(message || error) && <div className={`notice ${error ? 'notice-error' : ''}`} role="status">{error || message}<button onClick={() => { setMessage(''); setError('') }} aria-label="Fechar aviso"><X size={16} /></button></div>}
      {reminders.length > 0 && <div className="reminder-banner"><Bell size={17} /><span>{reminders.join(' ')}</span><button onClick={() => setReminders([])} aria-label="Fechar lembrete"><X size={15} /></button></div>}

      {showAccount && user && <section className="account-panel" aria-label="Painel da conta">
        <div className="account-heading"><div><span className="eyebrow">ÁREA {isManicure ? 'PROFISSIONAL' : 'DA CLIENTE'}</span><h2>Olá, {user.name.split(' ')[0]}.</h2></div><button className="icon-button" onClick={() => setShowAccount(false)} aria-label="Fechar painel"><X size={18} /></button></div>
        <div className="account-toolbar"><p>{isManicure ? 'Pedidos de horário e contato das clientes.' : 'Acompanhe seus pedidos e próximos atendimentos.'}</p><button className="text-action" onClick={requestReminderPermission}><Bell size={15} /> Ativar lembretes</button></div>
        {!isManicure && <form className="booking-form" onSubmit={handleBooking}>
          <h3><CalendarDays size={17} /> Solicitar horário</h3>
          <label>Serviço<select name="service_id" required defaultValue=""><option value="" disabled>Escolha um serviço</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.duration_minutes} min</option>)}</select></label>
          <label>Data e horário<input name="requested_at" type="datetime-local" required min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} /></label>
          <label className="full-field">O que você gostaria de fazer?<textarea name="description" rows={3} maxLength={1000} placeholder="Conte os detalhes, referências e dúvidas para a Marta." /></label>
          <button className="button button-dark" disabled={busy}>{busy ? 'Enviando…' : 'Enviar pedido'} <ArrowRight size={15} /></button>
        </form>}
        {isManicure && <form className="portfolio-admin" onSubmit={handlePortfolioPost}><h3>Adicionar ao portfólio</h3><label>Título<input name="title" required maxLength={120} placeholder="Ex.: Francesinha delicada" /></label><label>Endereço seguro da mídia<input name="media_url" type="url" required placeholder="https://…" /></label><label>Formato<select name="media_type"><option value="image">Foto</option><option value="video">Vídeo</option></select></label><label>Legenda<textarea name="caption" rows={2} maxLength={1000} /></label><button className="button button-dark button-small">Publicar trabalho <ArrowRight size={14} /></button></form>}
        <div className="appointment-list">
          <div className="list-heading"><h3>{isManicure ? 'Pedidos recebidos' : 'Sua agenda'}</h3><span>{appointments.length} {appointments.length === 1 ? 'pedido' : 'pedidos'}</span></div>
          {appointments.length === 0 ? <p className="empty-state">Nenhum agendamento por enquanto.</p> : appointments.map((appointment) => <article className="appointment-item" key={appointment.id}>
            <div className="appointment-top"><span className={`status status-${appointment.status}`}>{statusLabels[appointment.status]}</span><strong>{formatDate(appointment.confirmed_at ?? appointment.proposed_at ?? appointment.requested_at)}</strong></div>
            <h4>{appointment.service_name}</h4>
            {isManicure && <p className="client-contact">{appointment.client_name} · <a href={`tel:${appointment.client_phone}`}>{appointment.client_phone}</a></p>}
            {appointment.description && <p className="appointment-description">{appointment.description}</p>}
            {appointment.status === 'alternative_proposed' && !isManicure && <div className="appointment-actions"><button className="button button-dark button-small" onClick={() => updateAppointment(appointment.id, 'approved')}>Aceitar horário <Check size={14} /></button><button className="button button-quiet button-small" onClick={() => updateAppointment(appointment.id, 'cancelled')}>Não aceitar</button></div>}
            {isManicure && appointment.status === 'pending' && <div className="appointment-actions"><button className="button button-dark button-small" onClick={() => updateAppointment(appointment.id, 'approved')}>Aprovar <Check size={14} /></button><button className="button button-quiet button-small" onClick={() => setProposingId(appointment.id)}>Sugerir outro horário</button><button className="button button-quiet button-small" onClick={() => updateAppointment(appointment.id, 'rejected')}>Recusar</button></div>}
            {isManicure && proposingId === appointment.id && <form className="proposal-form" onSubmit={(event) => submitAlternative(event, appointment.id)}><label>Novo dia e horário<input name="proposed_at" type="datetime-local" required min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} /></label><div><button className="button button-dark button-small">Enviar sugestão</button><button type="button" className="button button-quiet button-small" onClick={() => setProposingId(null)}>Cancelar</button></div></form>}
            {isManicure && appointment.status === 'approved' && <div className="appointment-actions"><button className="button button-quiet button-small" onClick={() => updateAppointment(appointment.id, 'completed')}>Marcar como concluído</button></div>}
            {!isManicure && appointment.status === 'completed' && !appointment.review && <>{reviewingId === appointment.id ? <form className="review-form" onSubmit={(event) => submitReview(event, appointment.id)}><label>Sua nota<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} estrelas</option>)}</select></label><label>Comentário<textarea name="comment" rows={2} maxLength={1000} placeholder="Como foi sua experiência?" /></label><button className="button button-dark button-small">Enviar avaliação</button></form> : <button className="text-action review-trigger" onClick={() => setReviewingId(appointment.id)}><Star size={15} /> Avaliar atendimento</button>}</>}
            {appointment.review && <p className="review-note"><Star size={14} fill="currentColor" /> {appointment.review.rating}/5 · {appointment.review.comment}</p>}
          </article>)}
        </div>
        <button className="signout-button" onClick={signOut}><LogOut size={15} /> Sair da conta</button>
      </section>}

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy"><span className="eyebrow"><Sparkles size={14} /> BELEZA NOS DETALHES</span><h1>Um cuidado que<br /><em>tem a sua cara.</em></h1><p>Nail design feito com intenção, delicadeza e espaço para você ser você.</p><div className="hero-actions"><button className="button button-dark" onClick={() => user ? setShowAccount(true) : setAuthMode('register')}>Encontrar meu horário <ArrowRight size={16} /></button><a className="underlined-link" href="#portfolio">Conheça o trabalho <ArrowDown size={15} /></a></div><div className="hero-note"><span className="note-line" />Atendimento personalizado, do primeiro detalhe ao acabamento.</div></div>
          <div className="hero-visual"><div className="hero-image" role="img" aria-label="Composição editorial de cuidados com as unhas; substituir por foto autorizada da profissional"><div className="hero-image-caption"><span>mãos cuidadas,</span><em>confiança renovada</em></div></div><div className="hero-stamp"><span>feito com</span><strong>cuidado</strong><Sparkles size={18} /></div><span className="image-credit">Imagem ilustrativa · substituir por foto autorizada</span></div>
          <div className="hero-index">01 <span /> 03</div>
        </section>

        <section className="services-section section-wrap" id="servicos">
          <div className="section-intro"><div><span className="eyebrow">ESCOLHA O SEU MOMENTO</span><h2>Seu próximo<br /><em>detalhe favorito.</em></h2></div><p>Cada serviço começa com uma conversa. Escolha o que combina com você e conte suas ideias no pedido de horário.</p></div>
          <div className="service-grid">{services.length ? services.map((service, index) => <article className="service-card" key={service.id}><span className="service-number">0{index + 1}</span><span className="service-icon"><Scissors size={19} strokeWidth={1.5} /></span><h3>{service.name}</h3><p>{service.description}</p><div className="service-meta"><span>{service.duration_minutes} min</span><span>{service.price_cents ? `R$ ${(service.price_cents / 100).toFixed(2).replace('.', ',')}` : 'Valor sob consulta'}</span></div></article>) : <p className="empty-state">Os serviços estarão disponíveis em breve. Fale com a Marta pelo Instagram.</p>}</div>
        </section>

        <section className="portfolio-section" id="portfolio"><div className="portfolio-inner"><div className="portfolio-heading"><div><span className="eyebrow">INSPIRAÇÃO E PERSONALIDADE</span><h2>Um pouco de <em>brilho.</em></h2></div><a className="instagram-link" href="https://www.instagram.com/martah.dona/" target="_blank" rel="noreferrer"><Instagram size={17} /> @martah.dona <ArrowRight size={15} /></a></div><div className="gallery-grid">{portfolioPosts.length ? portfolioPosts.map((post) => <article className="portfolio-card" key={post.id}><div className="portfolio-card-media">{post.media_type === 'video' ? <video src={post.media_url} controls preload="metadata" aria-label={post.title} /> : <img src={post.media_url} alt={post.title} loading="lazy" />}</div><div className="portfolio-card-copy"><div><h3>{post.title}</h3>{post.caption && <p>{post.caption}</p>}</div><button type="button" className={`like-button ${post.liked_by_me ? 'is-liked' : ''}`} onClick={() => handleLike(post.id)} disabled={user?.role === 'manicure'} aria-label={`Curtir ${post.title}; ${post.like_count} curtidas`} aria-pressed={post.liked_by_me}><Heart size={17} fill={post.liked_by_me ? 'currentColor' : 'none'} /><span>{post.like_count}</span></button></div></article>) : <><article className="gallery-placeholder gallery-one"><span className="gallery-label">01 / ACABAMENTO</span><Sparkles size={25} /><p>Seu próximo<br />nail design começa aqui.</p><small>Foto autorizada da Marta</small></article><article className="gallery-placeholder gallery-two"><span className="gallery-label">02 / COR E FORMA</span><Scissors size={24} /><p>Detalhes que<br />falam por você.</p><small>Foto autorizada da Marta</small></article><article className="gallery-placeholder gallery-three"><span className="gallery-label">03 / NAIL ART</span><Star size={23} /><p>Uma ideia sua,<br />feita à mão.</p><small>Foto autorizada da Marta</small></article></>}</div><p className="gallery-note">Portfólio em atualização. As imagens serão publicadas com autorização da profissional.</p></div></section>

        <section className="about-section section-wrap" id="sobre"><div className="about-mark"><span>MD</span><span className="about-orbit" /></div><div className="about-copy"><span className="eyebrow">MARTA DONA SOUSA · NAIL DESIGNER</span><h2>Beleza com<br /><em>presença.</em></h2><p>Mais do que escolher uma cor, cuidar das unhas pode ser um momento seu. Aqui, cada atendimento é pensado com atenção, conversa e respeito ao seu estilo.</p><a className="underlined-link" href="https://www.instagram.com/martah.dona/" target="_blank" rel="noreferrer">Acompanhe no Instagram <ArrowRight size={15} /></a></div></section>

        <section className="booking-band"><div><span className="eyebrow">UM TEMPO PARA VOCÊ</span><h2>Vamos encontrar<br /><em>seu horário?</em></h2></div><button className="button button-light" onClick={() => user ? setShowAccount(true) : setAuthMode('register')}>Solicitar agendamento <ArrowRight size={16} /></button><span className="booking-sparkle sparkle-a">✳</span><span className="booking-sparkle sparkle-b">✳</span></section>
      </main>

      <footer className="site-footer"><a className="brand footer-brand" href="#inicio"><span className="brand-mark"><Scissors size={17} /></span><span><strong>MARTA DONA SOUSA</strong><small>NAIL DESIGNER</small></span></a><p>Feito com cuidado, para você.</p><a href="https://www.instagram.com/martah.dona/" target="_blank" rel="noreferrer" aria-label="Instagram de Marta"><Instagram size={19} /></a><small>© {new Date().getFullYear()} Marta Dona Sousa</small></footer>
      {authMode && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthMode(null) }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="icon-button modal-close" onClick={() => setAuthMode(null)} aria-label="Fechar"><X size={18} /></button><span className="eyebrow">SUA PRÓXIMA VISITA</span><h2 id="auth-title">{authMode === 'register' ? <>Crie sua<br /><em>conta.</em></> : <>Que bom<br /><em>te ver.</em></>}</h2><p>{authMode === 'register' ? 'Cadastre-se para pedir horários e acompanhar seus atendimentos.' : 'Entre para ver sua agenda e conversar sobre o próximo horário.'}</p><form className="auth-form" onSubmit={handleAuth}>{authMode === 'register' && <><label>Nome completo<input name="name" autoComplete="name" required minLength={2} /></label><label>Celular<input name="phone" type="tel" autoComplete="tel" required /></label></>}<label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>Senha<input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={8} required /></label><button className="button button-dark" disabled={busy}>{busy ? 'Aguarde…' : authMode === 'register' ? 'Criar conta' : 'Entrar'} <ArrowRight size={15} /></button></form><button className="auth-switch" onClick={() => { setError(''); setAuthMode(authMode === 'register' ? 'login' : 'register') }}>{authMode === 'register' ? 'Já tem uma conta? Entrar' : 'Ainda não tem cadastro? Criar conta'}</button></section></div>}
    </>
  )
}
