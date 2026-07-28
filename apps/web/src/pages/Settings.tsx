import { useState } from 'react';
import { Button, Callout, Field, Input, PageHead, Select, Switch, Tabs } from '@dock/ui';
import { KEEP_OPTIONS, PROXY_OPTIONS, TZ_OPTIONS } from '@dock/shared';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

const TABS = [
  { id: 'host', label: 'хост' },
  { id: 'net', label: 'сеть' },
  { id: 'backup', label: 'бэкапы' },
  { id: 'access', label: 'доступ' },
];

export function SettingsPage() {
  const { settings, backup, dirty, driver, actions } = useDock();
  const ui = useUi();
  const [tab, setTab] = useState('host');

  const edit = actions.editSettings;

  return (
    <div>
      <PageHead
        kicker="$ dock config edit"
        title="Настройки"
        lede="Всё, что здесь меняется, ложится в один файл ~/dock/dock.yml."
      />

      <Tabs items={TABS} value={tab} onChange={setTab} boxed />

      {tab === 'host' ? (
        <div className="dock-form">
          <Field label="Имя хоста" required>
            <Input value={settings.hostname} onChange={(e) => edit({ hostname: e.target.value })} />
          </Field>
          <Field label="Базовый домен" hint="// поддомены выдаются по имени сервиса">
            <Input value={settings.domain} onChange={(e) => edit({ domain: e.target.value })} />
          </Field>
          <Field label="Часовой пояс">
            <Select
              options={TZ_OPTIONS}
              value={settings.tz}
              onChange={(e) => edit({ tz: e.target.value })}
            />
          </Field>
          <Field label="Каталог данных">
            <Input prompt="~" value={settings.root} onChange={(e) => edit({ root: e.target.value })} />
          </Field>

          <div className="switches">
            <Switch
              label="автообновление образов раз в неделю"
              checked={settings.autoUpdate}
              onChange={() => edit({ autoUpdate: !settings.autoUpdate })}
              showState
            />
            <Switch
              label="скан-линии в интерфейсе"
              checked={settings.crt}
              onChange={() => edit({ crt: !settings.crt })}
              showState
            />
          </div>
        </div>
      ) : null}

      {tab === 'net' ? (
        <div className="dock-form">
          <Field label="Reverse proxy">
            <Select
              options={PROXY_OPTIONS}
              value={settings.proxy}
              onChange={(e) => edit({ proxy: e.target.value })}
            />
          </Field>
          <Field label="Порт панели">
            <Input
              value={settings.panelPort}
              onChange={(e) => edit({ panelPort: e.target.value })}
            />
          </Field>

          <div className="switches">
            <Switch
              label="выпускать сертификаты let's encrypt"
              checked={settings.tls}
              onChange={() => edit({ tls: !settings.tls })}
              showState
            />
            <Switch
              label="пускать только из локальной сети"
              checked={settings.lanOnly}
              onChange={() => edit({ lanOnly: !settings.lanOnly })}
              showState
            />
          </div>

          <div className="full">
            <Callout tone="note">
              Панель слушает только на loopback, наружу её отдаёт caddy. Если выключить прокси,
              доступ останется только по IP в локалке.
            </Callout>
          </div>
        </div>
      ) : null}

      {tab === 'backup' ? (
        <div className="dock-form">
          <Field label="Расписание" hint="// cron-выражение">
            <Input value={settings.cron} onChange={(e) => edit({ cron: e.target.value })} />
          </Field>
          <Field label="Хранить копий">
            <Select
              options={KEEP_OPTIONS}
              value={settings.keep}
              onChange={(e) => edit({ keep: e.target.value })}
            />
          </Field>

          <div className="full">
            <Field label="Куда складывать" hint="// локальный диск или свой s3">
              <Input
                prompt="~"
                value={settings.backupPath}
                onChange={(e) => edit({ backupPath: e.target.value })}
              />
            </Field>
          </div>

          <div className="row">
            <Button size="sm" onClick={() => void actions.runBackup()}>
              запустить бэкап сейчас
            </Button>
            <span className="dock-note">{backup.label}</span>
          </div>
        </div>
      ) : null}

      {tab === 'access' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 22, maxWidth: 840 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 22px' }}>
            <Field label="Оператор">
              <Input
                value={settings.operator}
                onChange={(e) => edit({ operator: e.target.value })}
              />
            </Field>
            <Field label="Драйвер ядра" hint="// задаётся переменной DOCK_DRIVER">
              <Input value={driver ? `${driver.driver} · ${driver.version}` : '—'} disabled />
            </Field>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Switch
              label="двухфакторный вход в панель"
              checked={settings.totp}
              onChange={() => edit({ totp: !settings.totp })}
              showState
            />
            <Switch
              label="писать аудит-лог действий"
              checked={settings.audit}
              onChange={() => edit({ audit: !settings.audit })}
              showState
            />
          </div>

          <div className="dock-divider" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 10.5, letterSpacing: '1.4px', color: 'var(--danger)' }}>
              ОПАСНАЯ ЗОНА
            </span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                size="sm"
                onClick={() =>
                  ui.ask({
                    title: 'Перезапустить dock?',
                    body: 'Панель будет недоступна около 10 секунд. Контейнеры продолжат работать — перезапускается только управляющий процесс.',
                    label: 'перезапустить',
                    onConfirm: () => void actions.restartDaemon(),
                  })
                }
              >
                перезапустить dock
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  ui.ask({
                    title: 'Сбросить конфиг?',
                    body: 'dock.yml вернётся к значениям по умолчанию. Контейнеры и тома останутся, но маршруты и домены придётся настроить заново.',
                    label: 'сбросить',
                    onConfirm: () => void actions.resetSettings(),
                  })
                }
              >
                сбросить конфиг
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          paddingTop: 26,
          marginTop: 22,
          borderTop: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <Button variant="primary" onClick={() => void actions.saveSettings()}>
          Сохранить изменения
        </Button>
        <Button size="sm" onClick={() => actions.revertSettings()}>
          откатить
        </Button>
        <span className="dock-note">
          {dirty ? '// есть несохранённые изменения' : '// всё записано в ~/dock/dock.yml'}
        </span>
      </div>
    </div>
  );
}
