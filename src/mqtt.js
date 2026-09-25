// mqtt.js — Eco Loco (Mellan), fas 4-STUBB: MQTT-sömmen mot den fysiska riggen.
// Topic-namnen är HELIGA — riggens firmware (ecolocooMicrocontrollerMqttClient) lyssnar
// på dem oförändrade:  ecoloco/<bänk>/money | resources | winner | looser |
//                      displaymoney | displayresources
//
// Adaptern lyssnar på motorns events och räknar ut vad varje bänk ska visa.
// publish-funktionen är utbytbar: console.log i mock/test, mqtt-över-websocket i drift
// (lokal mosquitto + repo `mqtt-websocket-broker` finns redan).

export const BENCH = { aker: 'eco1', skog: 'eco2', tundra: 'eco3', stad: 'eco4' }; // bekräfta mot firmware

// Standard-publish i mock: logga bara. I drift ersätts denna med en riktig MQTT-klient:
//   import mqtt from 'mqtt'; const c = mqtt.connect('ws://172.20.1.1:9001');
//   const publish = (topic, msg) => c.publish(topic, String(msg));
let publish = (topic, msg) => console.log(`[mqtt-mock] ${topic} ← ${msg}`);
export function setPublisher(fn) { publish = fn; }

// Koppla en motor-instans → publicera per bänk. Anropas från server (drift) eller ui (mock-test).
export function attachMqtt(engine) {
  const pushTeam = t => {
    const b = BENCH[t.id];
    publish(`ecoloco/${b}/money`, t.pengar);
    publish(`ecoloco/${b}/resources`, t.material);
    publish(`ecoloco/${b}/displaymoney`, t.pengar);
    publish(`ecoloco/${b}/displayresources`, t.material);
  };
  const pushAll = () => engine.getState()?.teams.forEach(pushTeam);

  engine.on('start', pushAll);
  engine.on('build', p => pushTeam(engine.team(p.teamId)));
  engine.on('trade', p => { pushTeam(engine.team(p.from)); pushTeam(engine.team(p.to)); });
  engine.on('income', p => pushTeam(engine.team(p.teamId)));
  engine.on('proposalResolved', pushAll);
  engine.on('event', pushAll);

  // Grön LED = ekonomisk ledare (👑) · varnings-LED = värsta boven (⚠, Klimatregistret).
  engine.on('roundEnd', () => {
    const lb = engine.leaderboards();
    engine.getState().teams.forEach(t => {
      publish(`ecoloco/${BENCH[t.id]}/winner`, t.id === lb.bors[0].id ? 1 : 0);
      publish(`ecoloco/${BENCH[t.id]}/looser`, t.id === lb.klimat[0].id && lb.klimat[0].skada < 0 ? 1 : 0);
    });
  });
  engine.on('gameEnd', p => {
    engine.getState().teams.forEach(t => {
      publish(`ecoloco/${BENCH[t.id]}/winner`, p.won && t.id === p.winner.teamId ? 1 : 0);
      publish(`ecoloco/${BENCH[t.id]}/looser`, p.klimatbov && t.id === p.klimatbov.teamId ? 1 : 0);
    });
  });
  // TODO fas 4: humör-/miljöfärg från öhälso-läget om riggen får den kanalen (nytt topic — stäm av).
}
