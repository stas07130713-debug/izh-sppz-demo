/**
 * Полевой помощник — телефон обходчика.
 *
 * Три экрана и ничего лишнего: вход, список с поиском, карточка предмета.
 * Обход идёт стоя, одной рукой, часто в перчатке — каждый лишний экран здесь
 * стоит дороже, чем за столом.
 *
 * Сроки и состояние считает то же ядро, что и настольная программа. Своего
 * расчёта у телефона нет: разойдись они — человек не будет знать, чему верить.
 *
 * Журнал уезжает целиком и живёт на телефоне: в здании связи может не быть
 * вовсе, и обход обязан идти по копии.
 */

import { useEffect, useMemo, useState } from 'react';
import type { PlanObject } from '@izh/contracts';
import { rulePackageSource } from '@izh/core';
import {
  enterField, liveObjects, serverSource, type FieldSnapshot, type FieldUser,
} from './field-data';
import { Login } from './Login';
import { ObjectList } from './ObjectList';
import { ObjectCard } from './ObjectCard';

/** Порог «скоро» на обходе. Приедет вместе со снимком, пока — общий. */
const SOON_DAYS = 14;

/** Адрес программы запоминается: набирать его на каждом обходе незачем. */
const ADDRESS_KEY = 'изж.адрес';

function rememberedAddress(): string {
  try {
    return window.localStorage.getItem(ADDRESS_KEY) ?? '';
  } catch {
    // Хранилище браузера бывает закрыто настройками. Это не повод падать.
    return '';
  }
}

export interface AppProps {
  /** День, от которого считаются сроки. Задан снаружи: так проверка повторяема. */
  readonly today: string;
}

export function App(props: AppProps): React.JSX.Element {
  /*
   * Адрес — тот, с которого открыли приложение.
   *
   * Веб-приложение отдаёт та же настольная программа, что и журнал: обходчик
   * набирает один адрес, а не два, и обращения на чужой источник нет вовсе —
   * браузер их запрещает, и телефон отвечал «программа не отвечает».
   *
   * Поле адреса остаётся на случай, когда приложение открыли иначе (например,
   * при разработке): тогда оно пустое, и адрес называют руками.
   */
  const [address, setAddress] = useState(() => rememberedAddress() || window.location.origin);
  const [who, setWho] = useState<FieldUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FieldSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<PlanObject | null>(null);

  useEffect(() => {
    if (token === null) return;
    void serverSource(address, token).load().then(setSnapshot);
  }, [token, address]);

  const objects = useMemo(() => (snapshot === null ? [] : liveObjects(snapshot)), [snapshot]);
  /*
   * Источник правил — нормативная библиотека. Регламенты организации приедут
   * вместе со снимком следующим шагом; пока телефон считает по библиотеке.
   */
  const source = rulePackageSource;

  if (token === null) {
    return (
      <div className="app">
        <header className="top"><h1>ИЖ СППЗ — обход</h1></header>
        <Login
          address={address}
          onAddress={(value) => {
            setAddress(value);
            try { window.localStorage.setItem(ADDRESS_KEY, value); } catch { /* закрыто настройками */ }
          }}
          onEnter={async (login, password, code) => {
            const entered = await enterField(address, login, password, code);
            if (!entered.ok) return entered.error;
            setWho(entered.value.кто);
            setToken(entered.value.пропуск);
            return null;
          }}
        />
      </div>
    );
  }

  if (snapshot === null) {
    return (
      <div className="app">
        <header className="top"><h1>Забираю журнал…</h1></header>
        <p className="empty">Идёт перенос. Связь нужна только сейчас — дальше обход идёт по копии.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top">
        {opened !== null && (
          <button type="button" className="back" onClick={() => setOpened(null)} aria-label="Назад к списку">
            ←
          </button>
        )}
        <div>
          <h1>{opened === null ? 'Обход' : (opened.regNumber ?? 'без номера')}</h1>
          <div className="place">
            {opened === null ? `оборудования: ${objects.length}` : 'карточка оборудования'}
          </div>
        </div>
        {/* Кто вошёл — на виду: под его именем встанет подпись. */}
        {who !== null && <div className="who">{who.фио}</div>}
      </header>

      {opened === null ? (
        <ObjectList
          snapshot={snapshot}
          objects={objects}
          events={snapshot.events}
          today={props.today}
          soonThresholdDays={SOON_DAYS}
          source={source}
          query={query}
          onQuery={setQuery}
          onOpen={setOpened}
        />
      ) : (
        <ObjectCard
          snapshot={snapshot}
          object={opened}
          events={snapshot.events}
          today={props.today}
          soonThresholdDays={SOON_DAYS}
          source={source}
        />
      )}
    </div>
  );
}
