import { useEffect, useState } from 'react';
import { Footer, MobileMenu, Topbar } from '@dock/ui';
import { ComposeDialog } from './components/ComposeDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Console } from './components/Console';
import { InstallDialog } from './components/InstallDialog';
import { Toasts } from './components/Toasts';
import { useHashRoute } from './hooks/useHashRoute';
import { CatalogPage } from './pages/Catalog';
import { LogsPage } from './pages/Logs';
import { ServiceDetailPage } from './pages/ServiceDetail';
import { ServicesPage } from './pages/Services';
import { SettingsPage } from './pages/Settings';
import { useDock } from './state/store';
import { useUi } from './state/ui';

const NAV = [
  { href: '#services', label: '~/services' },
  { href: '#catalog', label: '~/catalog' },
  { href: '#logs', label: '~/logs' },
  { href: '#settings', label: '~/settings' },
];

const FOOT_COLUMNS = [
  {
    title: 'ПАНЕЛЬ',
    links: [
      { href: '#services', label: 'сервисы' },
      { href: '#catalog', label: 'каталог' },
      { href: '#logs', label: 'журнал' },
      { href: '#settings', label: 'настройки' },
    ],
  },
  {
    title: 'ХОСТ',
    links: [
      { href: '#settings', label: 'хост и домен' },
      { href: '#settings', label: 'бэкапы' },
      { href: '#settings', label: 'доступ' },
    ],
  },
];

export function App() {
  const { settings, connected, driver } = useDock();
  const ui = useUi();
  const route = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  // Тема и скан-линии живут на <html>, чтобы переключение не перерисовывало дерево
  useEffect(() => {
    document.documentElement.dataset.crt = settings.crt ? 'on' : 'off';
  }, [settings.crt]);

  useEffect(() => setMenuOpen(false), [route.name, route.param]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '~' || e.code === 'Backquote')) {
        e.preventDefault();
        ui.togglePty();
      }
      if (e.key === 'Escape') ui.closeOverlays();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  const hostLabel = `${settings.operator}@${settings.hostname}`;
  const current = route.name === 'service' ? '#services' : `#${route.name}`;

  return (
    <div className="dock-shell">
      {settings.crt ? <div className="scanlines" /> : null}

      <Topbar
        brand="DOCK"
        brandSuffix={hostLabel}
        items={NAV}
        current={current}
        href="#services"
        onBurger={() => setMenuOpen((v) => !v)}
      />
      <MobileMenu items={NAV} open={menuOpen} />

      {/*
        Выдуманный хост обязан быть виден сразу и всегда. Mock рисует
        правдоподобные цифры — 64 ГБ, 4 ТБ, месяц аптайма, — и без этой полосы
        его невозможно отличить от настоящего железа, пока не полезешь в логи.
      */}
      {driver?.driver === 'mock' ? (
        <div className="dock-mock">
          <span className="dock-mock-tag">MOCK</span>
          выдуманный хост — докер не подключён, все цифры и действия синтетические.
          Настоящий режим включается переменной DOCK_DRIVER=docker
        </div>
      ) : null}

      <div className="dock-main">
        {!connected ? (
          <div className="dock-offline">
            <span style={{ color: 'var(--warn)' }}>●</span>
            связь с ядром потеряна — переподключаюсь
          </div>
        ) : driver && !driver.connected ? (
          <div className="dock-offline">
            <span style={{ color: 'var(--warn)' }}>●</span>
            {`докер недоступен: ${driver.message ?? 'сокет не отвечает'}`}
          </div>
        ) : driver?.driver === 'docker' && !driver.composeVersion ? (
          <div className="dock-offline">
            <span style={{ color: 'var(--warn)' }}>●</span>
            в образе панели нет docker compose — стеки поднять не выйдет
          </div>
        ) : null}

        {route.name === 'services' ? <ServicesPage /> : null}
        {route.name === 'service' && route.param ? <ServiceDetailPage id={route.param} /> : null}
        {route.name === 'catalog' ? <CatalogPage /> : null}
        {route.name === 'logs' ? <LogsPage svc={route.param} /> : null}
        {route.name === 'settings' ? <SettingsPage /> : null}
      </div>

      <Footer
        brand="DOCK"
        blurb="Панель управления своим железом. Работает локально, ничего не отправляет наружу."
        columns={FOOT_COLUMNS}
        meta={`dock 0.9.2 · ${hostLabel}`}
      />

      <InstallDialog />
      <ConfirmDialog />
      <ComposeDialog />
      <Console />
      <Toasts />
    </div>
  );
}
