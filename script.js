/* ===== JP Detailing — Lógica ===== */
(function(){
  "use strict";

  // ------- CONFIGURACION -------
  const WHATSAPP_NUMBER = "5493435451818"; // formato internacional sin +

  // Servicios (precio y duración editables)
  const SERVICIOS = [
    { id:"premium",  nombre:"Lavado Premium",     desc:"Lavado exterior completo, secado profesional y limpieza de llantas.", precio:12000, duracion:30 },
    { id:"interior", nombre:"Lavado Full Interior", desc:"Aspirado completo, limpieza de tapizados y tratamiento interior.",   precio:15000, duracion:30 },
    { id:"detailing",nombre:"Detailing Premium",  desc:"Pulido, protección y terminación profesional para tu vehículo.",       precio:35000, duracion:30 },
    { id:"express",  nombre:"Limpieza Express",   desc:"Lavado rápido, exterior + interior básico.",                            precio:8000,  duracion:30 }
  ];

  // Horarios laborales: Lunes(1)-Sabado(6). Domingo(0) cerrado.
  // Turnos cada 30 minutos.
  const HORARIOS = {
    manana: { desde:"09:00", hasta:"12:30" },
    tarde:  { desde:"16:30", hasta:"21:00" }
  };
  const INTERVALO_MIN = 30;

  // ------- UTILIDADES -------
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const uid = ()=> "T"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  function pad(n){ return String(n).padStart(2,"0"); }

  function toMin(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
  function toHHMM(min){ return pad(Math.floor(min/60))+":"+pad(min%60); }

  function generarSlots(){
    const out=[];
    [HORARIOS.manana, HORARIOS.tarde].forEach(rango=>{
      for(let m=toMin(rango.desde); m<=toMin(rango.hasta); m+=INTERVALO_MIN) out.push(toHHMM(m));
    });
    return out;
  }

  function fechaHoyISO(){
    const d=new Date();
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  }

  function formatFecha(iso){
    if(!iso) return "";
    const [y,m,d]=iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function esDomingo(iso){
    // Interpretar como fecha local
    const [y,m,d]=iso.split("-").map(Number);
    return new Date(y,m-1,d).getDay()===0;
  }

  // ------- STORAGE -------
  const STORAGE_KEY = "jp_detailing_turnos_v1";
  function getTurnos(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); }
    catch(e){ return []; }
  }
  function saveTurnos(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
  function addTurno(t){ const list=getTurnos(); list.push(t); saveTurnos(list); }
  function turnosPorFecha(iso){ return getTurnos().filter(t=>t.fecha===iso && t.estado!=="Cancelado"); }

  // ------- UI: SERVICIOS -------
  function renderServicios(){
    const grid = $("#serviciosGrid");
    const sel  = $("#servicio");
    grid.innerHTML = "";
    sel.innerHTML = '<option value="">Seleccionar…</option>';

    SERVICIOS.forEach(s=>{
      const card = document.createElement("div");
      card.className = "service-card";
      card.dataset.id = s.id;
      card.innerHTML = `
        <h3>${s.nombre}</h3>
        <p class="desc">${s.desc}</p>
        <div class="meta">
          <span class="price">$${s.precio.toLocaleString("es-AR")}</span>
          <span class="dur">${s.duracion} min</span>
        </div>`;
      card.addEventListener("click", ()=>{
        $$(".service-card").forEach(c=>c.classList.remove("active"));
        card.classList.add("active");
        sel.value = s.id;
        // scroll suave al formulario
        document.getElementById("reservar").scrollIntoView({behavior:"smooth"});
      });
      grid.appendChild(card);

      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.nombre} — $${s.precio.toLocaleString("es-AR")}`;
      sel.appendChild(opt);
    });

    sel.addEventListener("change", ()=>{
      $$(".service-card").forEach(c=>c.classList.toggle("active", c.dataset.id===sel.value));
    });
  }

  // ------- UI: SLOTS -------
  let slotSeleccionado = "";

  function renderSlots(){
    const fecha = $("#fecha").value;
    const cont  = $("#slots");
    const horaSel = $("#hora");

    cont.innerHTML = "";
    horaSel.innerHTML = '<option value="">Seleccionar…</option>';
    slotSeleccionado = "";

    if(!fecha){
      cont.innerHTML = '<div class="slots-empty">Seleccioná una fecha para ver los horarios.</div>';
      horaSel.disabled = true;
      horaSel.innerHTML = '<option value="">Seleccioná una fecha primero</option>';
      return;
    }
    if(esDomingo(fecha)){
      cont.innerHTML = '<div class="slots-empty">Los domingos permanecemos cerrados.</div>';
      horaSel.disabled = true;
      return;
    }
    if(fecha < fechaHoyISO()){
      cont.innerHTML = '<div class="slots-empty">La fecha seleccionada ya pasó.</div>';
      horaSel.disabled = true;
      return;
    }

    horaSel.disabled = false;
    const ocupados = new Set(turnosPorFecha(fecha).map(t=>t.hora));
    const hoy = fechaHoyISO();
    const ahoraMin = new Date().getHours()*60 + new Date().getMinutes();

    generarSlots().forEach(h=>{
      const slot = document.createElement("div");
      const esPasado = (fecha===hoy && toMin(h) <= ahoraMin);
      const ocupado  = ocupados.has(h) || esPasado;
      slot.className = "slot " + (ocupado ? "busy" : "free");
      slot.textContent = h;
      slot.title = ocupado ? "Horario reservado" : "Disponible";

      if(!ocupado){
        slot.addEventListener("click", ()=>{
          $$(".slot").forEach(s=>s.classList.remove("selected"));
          slot.classList.remove("free");
          slot.classList.add("selected");
          slotSeleccionado = h;
          horaSel.value = h;
        });
        const opt = document.createElement("option");
        opt.value = h; opt.textContent = h;
        horaSel.appendChild(opt);
      }
      cont.appendChild(slot);
    });

    horaSel.addEventListener("change", ()=>{
      slotSeleccionado = horaSel.value;
      $$(".slot").forEach(s=>{
        s.classList.remove("selected");
        if(s.textContent===slotSeleccionado){ s.classList.remove("free"); s.classList.add("selected"); }
      });
    }, { once:true });
  }

  // ------- ALERTA / MODAL -------
  let alertT;
  function showAlert(msg, type){
    const el = $("#alert");
    el.textContent = msg;
    el.className = "alert show" + (type==="success" ? " success" : "");
    clearTimeout(alertT);
    alertT = setTimeout(()=> el.classList.remove("show"), 3500);
  }

  function showLoading(v){ $("#loading").classList.toggle("show", v); }

  function openModal(turno, servicio){
    $("#resume").innerHTML = `
      <li><strong>Cliente</strong><span>${turno.nombre} ${turno.apellido}</span></li>
      <li><strong>Vehículo</strong><span>${turno.vehiculo} (${turno.patente})</span></li>
      <li><strong>Servicio</strong><span>${servicio.nombre}</span></li>
      <li><strong>Fecha</strong><span>${formatFecha(turno.fecha)}</span></li>
      <li><strong>Hora</strong><span>${turno.hora}</span></li>`;
    $("#modalConfirm").classList.add("open");
  }
  function closeModal(){ $("#modalConfirm").classList.remove("open"); }

  // ------- WHATSAPP -------
  function enviarWhatsApp(turno, servicio){
    const msg =
`🚗 *Nuevo turno JP Detailing*

*Cliente:*
${turno.nombre} ${turno.apellido}

*Vehículo:*
${turno.vehiculo}

*Patente:*
${turno.patente}

*Servicio:*
${servicio.nombre}

*Fecha:*
${formatFecha(turno.fecha)}

*Hora:*
${turno.hora}

*Teléfono:*
${turno.telefono}

*Observaciones:*
${turno.observaciones || "Sin observaciones"}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  // ------- SUBMIT -------
  function handleSubmit(e){
    e.preventDefault();
    const data = {
      nombre:        $("#nombre").value.trim(),
      apellido:      $("#apellido").value.trim(),
      telefono:      $("#telefono").value.trim(),
      vehiculo:      $("#vehiculo").value.trim(),
//      patente:       $("#patente").value.trim().toUpperCase(),
      servicio:      $("#servicio").value,
      fecha:         $("#fecha").value,
      hora:          $("#hora").value,
      observaciones: $("#observaciones").value.trim()
    };

    // Validaciones
    for(const k of ["nombre","apellido","telefono","vehiculo","servicio","fecha","hora"]){
      if(!data[k]){ showAlert("Completá todos los campos obligatorios."); return; }
    }
    if(data.fecha < fechaHoyISO()){ showAlert("La fecha no puede ser anterior a hoy."); return; }
    if(esDomingo(data.fecha)){ showAlert("No trabajamos los domingos."); return; }
    if(!generarSlots().includes(data.hora)){ showAlert("Horario fuera del rango laboral."); return; }

    const ocupados = new Set(turnosPorFecha(data.fecha).map(t=>t.hora));
    if(ocupados.has(data.hora)){ showAlert("Horario no disponible."); return; }

    const servicio = SERVICIOS.find(s=>s.id===data.servicio);
    if(!servicio){ showAlert("Servicio inválido."); return; }

    const turno = {
      id: uid(),
      ...data,
      estado: "Pendiente"
    };

    showLoading(true);
    setTimeout(()=>{
      addTurno(turno);
      showLoading(false);
      openModal(turno, servicio);
      showAlert("Turno reservado correctamente.", "success");
      enviarWhatsApp(turno, servicio);
      // reset parcial
      $("#reservaForm").reset();
      renderSlots();
      $$(".service-card").forEach(c=>c.classList.remove("active"));
    }, 700);
  }

  // ------- INIT -------
  function init(){
    // Fecha mínima = hoy
    const fechaInput = $("#fecha");
    fechaInput.min = fechaHoyISO();
    fechaInput.addEventListener("change", renderSlots);

    renderServicios();
    renderSlots();

    $("#reservaForm").addEventListener("submit", handleSubmit);
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalConfirm .modal-backdrop").addEventListener("click", closeModal);

    // Menú móvil
    $("#burger").addEventListener("click", ()=> $("#nav").classList.toggle("open"));
    $$("#nav a").forEach(a=> a.addEventListener("click", ()=> $("#nav").classList.remove("open")));

    $("#year").textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
