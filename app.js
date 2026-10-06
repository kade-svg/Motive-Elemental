const WEATHER = {
  0:["Clear sky","☀️"],1:["Mainly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],
  45:["Fog","🌫️"],48:["Rime fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Heavy drizzle","🌧️"],
  56:["Freezing drizzle","🌧️"],57:["Freezing drizzle","🌧️"],61:["Light rain","🌦️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],
  66:["Freezing rain","🌧️"],67:["Heavy freezing rain","🌧️"],71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],
  77:["Snow grains","❄️"],80:["Rain showers","🌦️"],81:["Rain showers","🌧️"],82:["Heavy showers","⛈️"],
  85:["Snow showers","🌨️"],86:["Heavy snow showers","❄️"],95:["Thunderstorm","⛈️"],96:["Storm + hail","⛈️"],99:["Storm + hail","⛈️"]
};
const $=id=>document.getElementById(id);
const state={unit:localStorage.getItem("elements-unit")||"celsius",place:null,data:null,lat:null,lon:null};

function w(code){return WEATHER[code]||["Unknown","🌤️"]}
function deg(v){return v==null?"—":Math.round(v)}
function fmtHour(t){return new Intl.DateTimeFormat(undefined,{hour:"numeric"}).format(new Date(t))}
function fmtUpdated(t){return new Intl.DateTimeFormat(undefined,{weekday:"short",hour:"numeric",minute:"2-digit"}).format(new Date(t))}
function fmtDate(t){return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(t+"T12:00:00"))}
function dayName(t){return new Intl.DateTimeFormat(undefined,{weekday:"long"}).format(new Date(t+"T12:00:00"))}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function speed(v){return `${Math.round(v)} ${state.unit==="fahrenheit"?"mph":"km/h"}`}

async function search(q){
  q=q.trim();
  if(q.length<2){$("searchResults").hidden=true;return}
  const box=$("searchResults"); box.hidden=false; box.innerHTML='<div class="search-result">Searching…</div>';
  try{
    const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    const data=await r.json(), results=data.results||[];
    if(!results.length){box.innerHTML='<div class="search-result">No places found.</div>';return}
    box.innerHTML=results.map((p,i)=>`<button class="search-result" data-i="${i}"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml([p.admin1,p.country].filter(Boolean).join(", "))}</span></button>`).join("");
    box.querySelectorAll("[data-i]").forEach(btn=>btn.onclick=()=>select(results[+btn.dataset.i]));
  }catch(e){console.error(e);box.innerHTML='<div class="search-result">Search is unavailable right now.</div>'}
}

function select(p){
  state.place=p;state.lat=+p.latitude;state.lon=+p.longitude;
  localStorage.setItem("elements-place",JSON.stringify(p));
  $("searchResults").hidden=true;$("searchInput").value="";
  loadWeather();
  $("today").scrollIntoView({behavior:"smooth",block:"start"});
}

async function loadWeather(){
  $("status").textContent="Updating weather…";
  const sp=new URLSearchParams({
    latitude:state.lat,longitude:state.lon,timezone:"auto",forecast_days:"7",
    current:"temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index",
    hourly:"temperature_2m,precipitation_probability,weather_code",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    temperature_unit:state.unit==="fahrenheit"?"fahrenheit":"celsius",
    wind_speed_unit:state.unit==="fahrenheit"?"mph":"kmh"
  });
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?${sp}`);
    if(!r.ok) throw new Error("Weather request failed");
    state.data=await r.json(); render(); $("status").textContent="";
  }catch(e){console.error(e);$("status").textContent="Couldn't load weather. Check your connection."}
}

function render(){
  const d=state.data,c=d.current,[condition,icon]=w(c.weather_code);
  $("locationName").textContent=state.place.name;
  $("region").textContent=[state.place.admin1,state.place.country].filter(Boolean).join(" • ").toUpperCase()||"YOUR WEATHER";
  $("updated").textContent=`Updated ${fmtUpdated(c.time)}`;
  $("conditionIcon").textContent=icon;
  $("temperature").textContent=deg(c.temperature_2m);
  $("degree").textContent=state.unit==="fahrenheit"?"°F":"°C";
  $("condition").textContent=condition;
  $("feels").textContent=`${deg(c.apparent_temperature)}°`;
  $("humidity").textContent=`${Math.round(c.relative_humidity_2m)}%`;
  $("wind").textContent=speed(c.wind_speed_10m);
  $("uv").textContent=Number(c.uv_index).toFixed(1);
  $("sun").textContent=d.daily.sunrise?.[0]&&d.daily.sunset?.[0]?`↑ ${fmtHour(d.daily.sunrise[0])}  •  ↓ ${fmtHour(d.daily.sunset[0])}`:"";
  renderHourly();renderDaily();
}

function renderHourly(){
  const h=state.data.hourly, now=new Date(state.data.current.time).getTime();
  let start=h.time.findIndex(t=>new Date(t).getTime()>=now); if(start<0)start=0;
  $("hourlyList").innerHTML=h.time.slice(start,start+24).map((t,n)=>{
    const i=start+n,[,icon]=w(h.weather_code[i]);
    return `<div class="hour"><div class="time">${n===0?"Now":fmtHour(t)}</div><div class="icon">${icon}</div><div class="temp">${deg(h.temperature_2m[i])}°</div><div class="rain">💧 ${h.precipitation_probability[i]??0}%</div></div>`
  }).join("");
}

function renderDaily(){
  const d=state.data.daily;
  $("dailyList").innerHTML=d.time.map((date,i)=>{
    const [,icon]=w(d.weather_code[i]);
    return `<div class="day"><div><div class="day-name">${i===0?"Today":dayName(date)}</div><div class="day-date">${fmtDate(date)}</div></div><div class="day-icon">${icon}</div><div class="range">${deg(d.temperature_2m_min[i])}° / ${deg(d.temperature_2m_max[i])}°</div><div class="chance">💧 ${d.precipitation_probability_max[i]??0}%</div></div>`
  }).join("");
}

function locate(){
  if(!navigator.geolocation){$("status").textContent="Location isn't available in this browser.";return}
  $("status").textContent="Finding your location…";
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat=pos.coords.latitude,lon=pos.coords.longitude;
    try{
      const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lat+","+lon)}&count=1&language=en&format=json`);
      const j=await r.json(); const p=j.results?.[0];
      select({name:p?.name||"Current location",admin1:p?.admin1||"",country:p?.country||"",latitude:lat,longitude:lon});
    }catch{
      select({name:"Current location",admin1:"",country:"",latitude:lat,longitude:lon});
    }
  },err=>{
    $("status").textContent=err.code===1?"Location permission was denied.":"Couldn't determine your location.";
  },{timeout:10000,maximumAge:300000});
}

$("searchForm").onsubmit=e=>{e.preventDefault();search($("searchInput").value)};
$("searchInput").oninput=()=>search($("searchInput").value);
$("locateButton").onclick=locate;
$("brandHome").onclick=e=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"})};
$("unitToggle").onclick=()=>{state.unit=state.unit==="celsius"?"fahrenheit":"celsius";localStorage.setItem("elements-unit",state.unit);$("unitToggle").textContent=state.unit==="celsius"?"°C":"°F";if(state.data)loadWeather()};
$("themeToggle").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("elements-theme",document.body.classList.contains("dark")?"dark":"light");$("themeToggle").textContent=document.body.classList.contains("dark")?"☾":"☼"};

document.addEventListener("click",e=>{if(!e.target.closest(".search"))$("searchResults").hidden=true});

(function init(){
  $("unitToggle").textContent=state.unit==="celsius"?"°C":"°F";
  if(localStorage.getItem("elements-theme")==="dark"){document.body.classList.add("dark");$("themeToggle").textContent="☾"}
  const saved=localStorage.getItem("elements-place");
  if(saved){try{select(JSON.parse(saved));return}catch{}}
  locate();
})();
