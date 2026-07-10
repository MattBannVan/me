/* =========================================================================
   CYBER CRIME FIGHTER — Emulated Device
   Renders an interactive 2D phone that changes with the player's rebuild
   choices. Form factor (island / notch / punch-hole / home-button), body
   color, wallpaper, carrier, clock, apps and nav are all driven by config.
   ========================================================================= */
const PHONE = (() => {

  function clockText(fmt){
    // Fixed "case time" so screenshots read consistently: 9:41-ish nod.
    return fmt === "24h" ? "21:41" : "9:41";
  }
  function ampm(fmt){ return fmt === "24h" ? "" : `<span class="ampm">PM</span>`; }

  function statusBar(cfg, region, carrier){
    const g = carrier ? `<span class="carrier-glyph" style="background:${carrier.color}">${carrier.glyph}</span>${carrier.name}` : "◦◦◦";
    return `<div class="ph-status">
      <span class="ph-carrier">${g}</span>
      <span class="ph-status-right">
        <span class="ph-signal"><i></i><i></i><i></i><i></i></span>
        <span class="ph-wifi">▂▄▆</span>
        <span class="ph-batt"><b style="width:72%"></b></span>
      </span>
    </div>`;
  }

  function notchEl(form){
    if (form === "dynamic-island") return `<div class="ph-island"></div>`;
    if (form === "notch") return `<div class="ph-notch"></div>`;
    if (form === "punch-hole-center") return `<div class="ph-punch center"></div>`;
    if (form === "punch-hole-left") return `<div class="ph-punch left"></div>`;
    return ``; // home-button: no top cutout
  }

  function lockScreen(device, cfg, region, carrier){
    const fmt = cfg.timeFormat || "12h";
    const stacked = device.clockStyle === "stacked-serif";
    return `<div class="ph-screen mode-lock">
      ${statusBar(cfg, region, carrier)}
      <div class="ph-lock-clock ${device.clockStyle}">
        <div class="ph-time">${clockText(fmt)} ${ampm(fmt)}</div>
        <div class="ph-date">${region ? region.name : "—"} · Wed, Jul 2</div>
      </div>
      <div class="ph-lock-notif">
        <span class="carrier-glyph sm" style="background:${carrier?carrier.color:'#555'}">${carrier?carrier.glyph:'?'}</span>
        1 missed call
      </div>
      <div class="ph-lock-bottom">
        <div class="ph-flash">⚡</div>
        <div class="ph-hint">${cfg.nav === "buttons" ? "Press home to unlock" : "Swipe up to unlock"}</div>
        <div class="ph-cam">📷</div>
      </div>
    </div>`;
  }

  function appTile(id){
    const app = getApp(id) || { name:id };
    return `<div class="ph-app"><div class="ph-app-ic">${ART.appIcon(id)}</div><div class="ph-app-lbl">${app.name}</div></div>`;
  }

  function homeScreen(device, cfg, region, carrier){
    const apps = (cfg.apps && cfg.apps.length ? cfg.apps : ["phone","messages","camera","settings"]);
    const dock = apps.slice(0,4);
    const grid = apps.slice(4);
    const fmt = cfg.timeFormat || "12h";
    return `<div class="ph-screen mode-home">
      ${statusBar(cfg, region, carrier)}
      <div class="ph-home-widget">
        <div class="ph-widget-time">${clockText(fmt)} ${ampm(fmt)}</div>
        <div class="ph-widget-sub">${device.launcher} · ${carrier?carrier.name:''}</div>
      </div>
      <div class="ph-grid">${grid.map(appTile).join("")}</div>
      <div class="ph-dock">${dock.map(appTile).join("")}</div>
      ${cfg.nav === "buttons"
        ? `<div class="ph-navbar"><span>◁</span><span>○</span><span>▢</span></div>`
        : `<div class="ph-gesturebar"></div>`}
    </div>`;
  }

  function bootScreen(device){
    return `<div class="ph-screen mode-boot">
      <div class="ph-boot-logo">${device.brand}</div>
      <div class="ph-boot-bar"><b></b></div>
    </div>`;
  }

  // mode: 'lock' | 'home' | 'boot'
  function render(target, device, cfg={}, mode="home"){
    const region = getRegion(cfg.region);
    const carrier = getCarrier(cfg.carrier);
    const wp = getWallpaper(cfg.wallpaper);
    const body = cfg.bodyColor || (device.bodyColors ? device.bodyColors[0] : "#333");
    const wpSvg = wp ? ART.wallpaper(wp) : ART.wallpaper(getWallpaper("carbon"));

    let screen = "";
    if (mode === "boot") screen = bootScreen(device);
    else if (mode === "lock") screen = lockScreen(device, cfg, region, carrier);
    else screen = homeScreen(device, cfg, region, carrier);

    const compact = device.size === "compact" ? "compact" : device.size === "large" ? "large" : "";

    target.innerHTML = `
      <div class="phone ${device.form} ${compact}" style="--body:${body}">
        <div class="ph-side vol"></div>
        <div class="ph-side pwr"></div>
        <div class="ph-body">
          <div class="ph-wallpaper">${wpSvg}</div>
          ${notchEl(device.form)}
          ${screen}
          ${device.form === "home-button" ? `<div class="ph-homebtn"></div>` : ""}
        </div>
      </div>`;
  }

  return { render, clockText };
})();
