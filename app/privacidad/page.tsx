import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/app/components/public-shell";
import {
  DATA_PROCESSORS,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_CONTROLLER,
  PRIVACY_UPDATED_AT,
  TERMS_URL,
} from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda la Liga Robótica Neuquina, para qué, quién los ve y cómo pedir que se corrijan o se borren.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel-card rounded-xl p-5 sm:p-6 space-y-3 scroll-mt-24">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Contact() {
  if (PRIVACY_CONTACT_EMAIL) {
    return (
      <a className="font-semibold underline underline-offset-2" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
        {PRIVACY_CONTACT_EMAIL}
      </a>
    );
  }
  return <span className="font-semibold">los canales de contacto de la organización de la Liga</span>;
}

export default function PrivacidadPage() {
  return (
    <PublicShell>
      <article className="space-y-5">
        <header className="space-y-2 py-2">
          <p className="text-xs panel-label uppercase tracking-wide">Legal</p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Política de privacidad</h1>
          <p className="panel-label text-sm">Última actualización: {PRIVACY_UPDATED_AT}</p>
          <p className="text-[15px] leading-relaxed">
            Acá contamos qué datos guarda este sistema, para qué se usan, quién los puede ver y cómo pedir que se
            corrijan o se borren. Se aplica la Ley 25.326 de Protección de Datos Personales.
          </p>
        </header>

        <Section id="responsable" title="Quién es responsable">
          <p>
            El responsable de los datos personales de la Liga Robótica Neuquina es{" "}
            <strong>{PRIVACY_CONTROLLER}</strong>. Para cualquier consulta o pedido sobre tus datos, escribí a{" "}
            <Contact />.
          </p>
        </Section>

        <Section id="datos" title="Qué datos guardamos y para qué">
          <p>
            <strong>Inscripción de un equipo.</strong> Nombre del equipo y de los robots, escuela o institución,
            provincia y localidad, nombre, celular y email del mentor o profesor (una persona mayor de edad
            responsable del equipo), y nombre y edad de cada integrante. Se usan para organizar la jornada: armar
            las categorías, acreditar a los equipos, avisar cambios al mentor y preparar la premiación.
          </p>
          <p>
            <strong>Durante la jornada.</strong> Acreditación, presentes, resultados de los partidos, tarjetas y
            posiciones.
          </p>
          <p>
            <strong>Encuesta de satisfacción.</strong> Las respuestas, y el email solo si marcás que aceptás que ANIDE
            (Agencia Neuquina de Innovación para el Desarrollo) te contacte con novedades de la Red Neuquina de
            Robótica e Innovación. El navegador guarda un identificador al azar para no contar dos veces la misma
            respuesta.
          </p>
          <p>
            <strong>Administradores.</strong> Email y contraseña para entrar al panel. La contraseña se guarda
            cifrada; nadie de la organización puede verla.
          </p>
          <p>
            No pedimos DNI, domicilio ni datos de salud, y no usamos los datos para publicidad ni los vendemos.
          </p>
        </Section>

        <Section id="publico" title="Qué se muestra en público">
          <p>
            En el sitio, las pantallas del evento y la planilla de cada cancha se ven el <strong>nombre del
            equipo y de los robots</strong>, la <strong>institución</strong>, el <strong>nombre de los
            integrantes</strong> (para la premiación) y los <strong>resultados</strong>.
          </p>
          <p>
            <strong>Nunca se muestran</strong> la edad de los integrantes ni los datos de contacto del mentor: esos
            datos los ve solo la organización.
          </p>
        </Section>

        <Section id="menores" title="Menores de edad">
          <p>
            Muchos participantes son menores. Por eso la inscripción la hace siempre un adulto responsable (el
            mentor o profesor), que declara contar con la autorización de las familias para inscribir a los
            integrantes. De los chicos guardamos solo el nombre y la edad, y la edad no se publica.
          </p>
        </Section>

        <Section id="proveedores" title="Proveedores que procesan datos">
          <p>Para funcionar, el sistema usa estos servicios externos:</p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="panel-label border-b border-current/10">
                  <th className="py-2 px-1 font-semibold">Proveedor</th>
                  <th className="py-2 px-1 font-semibold">Para qué</th>
                  <th className="py-2 px-1 font-semibold">País</th>
                </tr>
              </thead>
              <tbody>
                {DATA_PROCESSORS.map((p) => (
                  <tr key={p.name} className="border-b border-current/10 align-top">
                    <td className="py-2 px-1 font-semibold whitespace-nowrap">{p.name}</td>
                    <td className="py-2 px-1">{p.role}</td>
                    <td className="py-2 px-1">{p.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Esto implica que los datos se guardan fuera de Argentina. Al inscribirte aceptás esa transferencia, que
            se hace con proveedores que aplican medidas de seguridad acordes.
          </p>
        </Section>

        <Section id="cookies" title="Cookies y almacenamiento del navegador">
          <p>
            Este sitio <strong>no usa cookies de publicidad ni de analítica</strong>, y no tiene rastreadores de
            terceros. Solo usa:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cookies de sesión del panel de administración, necesarias para mantener el ingreso.</li>
            <li>La preferencia de tema claro u oscuro, guardada en tu navegador.</li>
            <li>El identificador de la encuesta (ver arriba).</li>
          </ul>
        </Section>

        <Section id="derechos" title="Tus derechos: ver, corregir o borrar tus datos">
          <p>
            Podés pedir en cualquier momento <strong>ver</strong> qué datos tenemos de tu equipo,
            <strong> corregirlos</strong> o <strong>borrarlos</strong>, escribiendo a <Contact />. Contanos el nombre
            del equipo y la jornada. Respondemos dentro de los plazos de la ley: 10 días corridos para pedidos de
            acceso y 5 días hábiles para correcciones o bajas. El acceso es gratuito cada seis meses.
          </p>
          <p>
            Si borramos los datos de un equipo que ya jugó, los resultados de la jornada se conservan con el nombre del
            equipo para que las tablas sigan cerrando, pero sin los datos del mentor ni de los integrantes.
          </p>
          <p className="text-sm panel-label">
            La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326,
            tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus
            derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
          </p>
        </Section>

        <Section id="seguridad" title="Seguridad y conservación">
          <p>
            El sitio funciona siempre con conexión cifrada (HTTPS). Los datos de contacto y las edades solo los puede
            leer el equipo de la organización con usuario y contraseña. Guardamos los datos mientras sean útiles para la
            organización de la liga y su historia (resultados y estadísticas por edición); podés pedir la baja antes en
            cualquier momento.
          </p>
        </Section>

        <Section id="bases" title="Bases y condiciones">
          <p>
            Las reglas de la competencia están en las{" "}
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              bases y condiciones
            </a>
            , que se aceptan al inscribir un equipo.
          </p>
        </Section>

        <p className="text-sm panel-label pb-4">
          <Link href="/" className="underline underline-offset-2">
            Volver al inicio
          </Link>
        </p>
      </article>
    </PublicShell>
  );
}
