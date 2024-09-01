/** @jsxImportSource @emotion/react */


import { Fragment, useContext, useEffect, useRef, useState } from "react"
import { ColorModeContext, EventLoopContext } from "/utils/context"
import { Event, getBackendURL, isTrue, refs } from "/utils/state"
import { WifiOffIcon as LucideWifiOffIcon } from "lucide-react"
import { keyframes } from "@emotion/react"
import { toast, Toaster } from "sonner"
import env from "/env.json"
import { Avatar as RadixThemesAvatar, Box as RadixThemesBox, Button as RadixThemesButton, Container as RadixThemesContainer, Flex as RadixThemesFlex, Heading as RadixThemesHeading, Link as RadixThemesLink, Text as RadixThemesText } from "@radix-ui/themes"
import Script from "next/script"
import NextLink from "next/link"
import NextHead from "next/head"



export function Fragment_cf53a535ae2e610a113dd361eb6ac95b () {
  const [addEvents, connectErrors] = useContext(EventLoopContext);



  return (
    <Fragment>
  {isTrue(connectErrors.length > 0) ? (
  <Fragment>
  <LucideWifiOffIcon css={{"color": "crimson", "zIndex": 9999, "position": "fixed", "bottom": "33px", "right": "33px", "animation": `${pulse} 1s infinite`}} size={32}/>
</Fragment>
) : (
  <Fragment/>
)}
</Fragment>
  )
}

export function Link_c0dd49c77b7cfd083d76e485059fd9f4 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "fontSize": "1em"}} target={isTrue(false) ? `_blank` : ``}>
  <NextLink href={`/`} passHref={true}>
  <RadixThemesBox>
  <RadixThemesText as={`p`} css={{"fontFamily": "Pulse_virgin", "--default-font-family": "Pulse_virgin", "fontWeight": "500", "fontSize": "1.7em", "&:hover": {"color": "#045b90"}, "color": "#908986", "alt": "Logotipo de DanielBanariba."}}>
  {`DANIEL
BANARIBA`}
</RadixThemesText>
</RadixThemesBox>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_ae36edc148075f3fa5c37c115bf5cdcd () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`mailto:danielbanariba@protonmail.com`} passHref={true}>
  <RadixThemesButton css={{"width": "100%", "height": "100%", "padding": "0.5em", "borderRadius": "1em", "color": "#fff8ee", "backgroundColor": "#0a121f", "whiteSpace": "normal", "textAlign": "start", "&:hover": {"backgroundColor": "#022b44"}}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"width": "100%"}} direction={`row`} gap={`3`}>
  <img alt={`Email`} css={{"width": "1.5em", "height": "1.5em", "margin": "0.8em"}} src={`icons/email.svg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "start", "paddingTop": "0.5em", "paddingBottom": "0.5em", "paddingRight": "0.5em"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesText as={`p`} css={{"fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "1em", "color": "#fff8ee"}}>
  {`Email`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"fontWeight": "300", "fontSize": "0.8em", "color": "#ccc6be"}}>
  {`danielbanariba@protonmail.com`}
</RadixThemesText>
</RadixThemesFlex>
</RadixThemesFlex>
</RadixThemesButton>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_e4fae4d11b03179ddbd03b7fcae92906 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://youtu.be/vE5s7QdB95I?si=KntI0wqkG7Qj3XVF`} passHref={true}>
  <img alt={`Sobreporrosis - Acá no es Party Sesiones`} css={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "&:hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}} src={`img_video/sobreporrosis.jpg`}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_b6edeccad733a90423e845edf202d88f () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://youtu.be/lvH-dy-Gn0Y`} passHref={true}>
  <img alt={`Desmembramiento - Maldita Enfermedad`} css={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "&:hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}} src={`img_video/desmembramiento.webp`}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_48acdf72d3d7f60524f703223f231507 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://www.instagram.com/danielbanariba/`} passHref={true}>
  <div className={`rx-Html`} dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .instagram-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .instagram-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"instagram-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Instagram</title>\n                        <path d=\"M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z\"/>\n                    </svg>\n            "}}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_ffe9ab6cc542f7c175bd3de3a21b7530 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://youtu.be/548LqsbFhSw`} passHref={true}>
  <img alt={`Krisis - Johd Ass`} css={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "&:hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}} src={`img_video/krisis.webp`}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_c10a8e204007439912b247734cfe4798 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://youtu.be/EAZR_GLTHyw`} passHref={true}>
  <img alt={`Lesath - El Enviado de Satán`} css={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "&:hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}} src={`img_video/lesath.jpg`}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_23329e395d8fedfca4efb8b8ff9d4410 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://www.tiktok.com/@danielbanariba`} passHref={true}>
  <div className={`rx-Html`} dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .tiktok-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .tiktok-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"tiktok-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>TikTok</title>\n                        <path d=\"M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z\"/>\n                    </svg>\n            "}}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_98e5e4d8b141df1814437cf25d7e54de () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://www.youtube.com/channel/UCa5U18nMgHUsqg-zsE1779Q`} passHref={true}>
  <div className={`rx-Html`} dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .youtube-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .youtube-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"youtube-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Youtube</title>\n                        <path d=\"M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z\"/>\n                    </svg>\n            "}}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_9c6cb73cb372754b600bf2887d880c02 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://www.linkedin.com/in/danielbanariba/`} passHref={true}>
  <div className={`rx-Html`} dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .linkedin-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .linkedin-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"linkedin-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>LinkedIn</title>\n                        <path d=\"M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z\"/>\n                    </svg>\n            "}}/>
</NextLink>
</RadixThemesLink>
  )
}

const pulse = keyframes`
    0% {
        opacity: 0;
    }
    100% {
        opacity: 1;
    }
`


export function Toaster_6e90e5e87a1cac8c96c683214079bef3 () {
  const { resolvedColorMode } = useContext(ColorModeContext)


  refs['__toast'] = toast
  const [addEvents, connectErrors] = useContext(EventLoopContext);
  
const toast_props = {"description": `Check if server is reachable at ${getBackendURL(env.EVENT).href}`, "closeButton": true, "duration": 120000, "id": "websocket-error"};
const [userDismissed, setUserDismissed] = useState(false);
useEffect(() => {
    if (connectErrors.length >= 2) {
        if (!userDismissed) {
            toast.error(
                `Cannot connect to server: ${(connectErrors.length > 0) ? connectErrors[connectErrors.length - 1].message : ''}.`,
                {...toast_props, onDismiss: () => setUserDismissed(true)},
            )
        }
    } else {
        toast.dismiss("websocket-error");
        setUserDismissed(false);  // after reconnection reset dismissed state
    }
}, [connectErrors]);

  return (
    <Toaster closeButton={false} expand={true} position={`bottom-right`} richColors={true} theme={resolvedColorMode}/>
  )
}

export function Link_f0d7d787bbcda4fe325b50b9530ab066 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://github.com/danielbanariba`} passHref={true}>
  <div className={`rx-Html`} dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .github-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .github-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"github-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>GitHub</title>\n                        <path d=\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"/>\n                    </svg>\n            "}}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Div_ac2a89ea84667d600a059f034bd91dfe () {
  const [addEvents, connectErrors] = useContext(EventLoopContext);



  return (
    <div css={{"position": "fixed", "width": "100vw", "height": "0"}} title={`Connection Error: ${(connectErrors.length > 0) ? connectErrors[connectErrors.length - 1].message : ''}`}>
  <Fragment_cf53a535ae2e610a113dd361eb6ac95b/>
</div>
  )
}

export function Link_90a8c5717cb9b0ad1bceb4c044bf6532 () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v`} passHref={true}>
  <img alt={`Blasfemia - Inmaculada Concepción`} css={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "&:hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}} src={`img_video/blasfemia.jpg`}/>
</NextLink>
</RadixThemesLink>
  )
}

export function Link_9816f97be69c3df5cd02613dfd80923f () {



  return (
    <RadixThemesLink asChild={true} css={{"textDecoration": "none", "&:hover": {"color": "var(--accent-8)"}, "width": "100%"}} target={isTrue(true) ? `_blank` : ``}>
  <NextLink href={`https://www.facebook.com/profile.php?id=100063668491929`} passHref={true}>
  <div className={`rx-Html`} dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .facebook-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .facebook-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"facebook-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Facebook</title>\n                        <path d=\"M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5V334.2H141.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H287V510.1C413.8 494.8 512 386.9 512 256h0z\"/>\n                    </svg>\n            "}}/>
</NextLink>
</RadixThemesLink>
  )
}

export default function Component() {
  const ref__ = useRef(null); refs['ref__'] = ref__;

  return (
    <Fragment>
  <Fragment>
  <Div_ac2a89ea84667d600a059f034bd91dfe/>
  <Toaster_6e90e5e87a1cac8c96c683214079bef3/>
</Fragment>
  <RadixThemesBox>
  <Script strategy={`afterInteractive`}>
  {`document.documentElement.lang='es'`}
</Script>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"position": "sticky", "background": "#0a121f", "paddingInlineStart": "2.2em", "paddingInlineEnd": "2.2em", "paddingTop": "1em", "paddingBottom": "1em", "zIndex": "999", "top": "0"}} direction={`row`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"fontFamily": "DinaRemasterII", "--default-font-family": "DinaRemasterII", "fontWeight": "500", "fontSize": "2.2em"}} direction={`row`} gap={`0px !important`}>
  <RadixThemesText as={`p`} css={{"color": "#f1d700"}}>
  {`{`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"color": "#c398f4"}}>
  {`daniel_banariba`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"color": "#f1d700"}}>
  {`}`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"color": "#bbbbbb"}}>
  {`;`}
</RadixThemesText>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesFlex css={{"display": "flex", "alignItems": "center", "justifyContent": "center"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"maxWidth": "800px", "width": "100%", "marginTop": "2.2em", "marginBottom": "2.2em", "padding": "0px !important"}} direction={`column`} id={`/`} ref={ref__} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"width": "100%", "alignItems": "start", "paddingRight": "2.2em", "paddingLeft": "2.2em"}} direction={`column`} gap={`1.1em`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "width": "100%"}} direction={`row`} gap={`3`}>
  <RadixThemesAvatar css={{"name": "Daniel Banariba", "color": "#ccc6be", "background": "#0a121f", "padding": "2px", "border": "4px solid", "borderColor": "#0073a8"}} radius={`full`} size={`8`} src={`avatar.jpg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"justifyContent": "center", "alignItems": "start", "height": "100%"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesHeading css={{"color": "#fff8ee", "fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "2.2em"}}>
  {`Daniel Banariba`}
</RadixThemesHeading>
  <RadixThemesText as={`p`} css={{"marginTop": "0px !important", "color": "#0073a8", "fontSize": "1.1em"}}>
  {`@danielbanariba`}
</RadixThemesText>
  <RadixThemesBox css={{"@media screen and (min-width: 0)": {"display": "none"}, "@media screen and (min-width: 30em)": {"display": "block"}, "@media screen and (min-width: 48em)": {"display": "block"}, "@media screen and (min-width: 62em)": {"display": "block"}}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`1.7em`}>
  <Link_f0d7d787bbcda4fe325b50b9530ab066/>
  <Link_48acdf72d3d7f60524f703223f231507/>
  <Link_9816f97be69c3df5cd02613dfd80923f/>
  <Link_98e5e4d8b141df1814437cf25d7e54de/>
  <Link_23329e395d8fedfca4efb8b8ff9d4410/>
  <Link_9c6cb73cb372754b600bf2887d880c02/>
</RadixThemesFlex>
</RadixThemesBox>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesBox css={{"@media screen and (min-width: 0)": {"display": "block"}, "@media screen and (min-width: 30em)": {"display": "none"}, "@media screen and (min-width: 48em)": {"display": "none"}, "@media screen and (min-width: 62em)": {"display": "none"}}}>
  <RadixThemesContainer css={{"padding": "16px", "centerContent": true, "spacing": "3em"}} size={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`column`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`1.7em`}>
  <Link_f0d7d787bbcda4fe325b50b9530ab066/>
  <Link_48acdf72d3d7f60524f703223f231507/>
  <Link_9816f97be69c3df5cd02613dfd80923f/>
  <Link_98e5e4d8b141df1814437cf25d7e54de/>
  <Link_23329e395d8fedfca4efb8b8ff9d4410/>
  <Link_9c6cb73cb372754b600bf2887d880c02/>
</RadixThemesFlex>
</RadixThemesFlex>
</RadixThemesContainer>
</RadixThemesBox>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"width": "100%", "paddingRight": "2.2em"}} direction={`row`} gap={`3`}>
  <RadixThemesBox css={{"fontSize": "1em", "color": "#ccc6be", "justify": "between"}}>
  <RadixThemesText as={`p`} css={{"fontWeight": "bold", "color": "#0073a8"}}>
  {`3+`}
</RadixThemesText>
  {`Años de experiencia programando`}
</RadixThemesBox>
  <RadixThemesFlex css={{"flex": 1, "justifySelf": "stretch", "alignSelf": "stretch"}}/>
  <RadixThemesBox css={{"fontSize": "1em", "color": "#ccc6be", "justify": "between"}}>
  <RadixThemesText as={`p`} css={{"fontWeight": "bold", "color": "#0073a8"}}>
  {`6+`}
</RadixThemesText>
  {`Años de experiencia editando y filmando videos`}
</RadixThemesBox>
  <RadixThemesFlex css={{"flex": 1, "justifySelf": "stretch", "alignSelf": "stretch"}}/>
  <RadixThemesBox css={{"fontSize": "1em", "color": "#ccc6be", "justify": "between"}}>
  <RadixThemesText as={`p`} css={{"fontWeight": "bold", "color": "#0073a8"}}>
  {`+6000 `}
</RadixThemesText>
  {`Suscriptores en Youtube`}
</RadixThemesBox>
</RadixThemesFlex>
  <RadixThemesText as={`p`} css={{"fontSize": "1.1em", "color": "#ccc6be", "width": "100%"}}>
  {`Soy un programador amante de la música extrema y la música en general, me encanta el septimo arte
            y todo lo que conlleva que sea edicion, filmacion, y direccion, he trabajado con multiples bandas al rededor de mi carrera
            haciendo trabajos como videos músicales, live seccion, grabaciones en vivo y documentales.
            `}
</RadixThemesText>
</RadixThemesFlex>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"width": "100%", "paddingRight": "2.2em", "paddingLeft": "2.2em"}} direction={`column`} gap={`1em`}>
  <RadixThemesHeading css={{"color": "#fff8ee", "fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "width": "100%", "paddingTop": "1em", "fontSize": "1.5em"}}>
  {`Proyectos audiovisuales`}
</RadixThemesHeading>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesBox css={{"width": "100%"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "background": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}} direction={`column`} gap={`3`}>
  <img alt={`Blasfemia - Inmaculada Concepción`} css={{"width": "50%", "height": "50%", "margin": "0.2em", "alignSelf": "center"}} src={`logo_bandas/blasfemia.svg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "paddingTop": "0.5em", "paddingBottom": "0.5em", "paddingRight": "0.5em"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesText as={`p`} css={{"fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Blasfemia - Inmaculada Concepción`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Blasfemia es una banda de Brutal Death Metal originario de Tegucigalpa, Honduras.`}
</RadixThemesText>
</RadixThemesFlex>
  <Link_90a8c5717cb9b0ad1bceb4c044bf6532/>
</RadixThemesFlex>
</RadixThemesBox>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesBox css={{"width": "100%"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "background": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}} direction={`column`} gap={`3`}>
  <img alt={`Sobreporrosis - Acá no es Party Sesiones`} css={{"width": "70%", "height": "70%", "margin": "0.2em", "alignSelf": "center"}} src={`logo_bandas/sobreporrosis.svg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "paddingTop": "0.5em", "paddingBottom": "0.5em", "paddingRight": "0.5em"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesText as={`p`} css={{"fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Sobreporrosis - Acá no es Party Sesiones`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Sobreporrosis es una banda de Punk Rock originario de Tegucigalpa, Honduras.`}
</RadixThemesText>
</RadixThemesFlex>
  <Link_e4fae4d11b03179ddbd03b7fcae92906/>
</RadixThemesFlex>
</RadixThemesBox>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesBox css={{"width": "100%"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "background": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}} direction={`column`} gap={`3`}>
  <img alt={`Lesath - El Enviado de Satán`} css={{"width": "30%", "height": "30%", "margin": "0.2em", "alignSelf": "center"}} src={`logo_bandas/lesath.svg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "paddingTop": "0.5em", "paddingBottom": "0.5em", "paddingRight": "0.5em"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesText as={`p`} css={{"fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Lesath - El Enviado de Satán`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Lesath es una banda de Death Metal Melódico originario de Tegucigalpa, Honduras.`}
</RadixThemesText>
</RadixThemesFlex>
  <Link_c10a8e204007439912b247734cfe4798/>
</RadixThemesFlex>
</RadixThemesBox>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesBox css={{"width": "100%"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "background": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}} direction={`column`} gap={`3`}>
  <img alt={`Desmembramiento - Maldita Enfermedad`} css={{"width": "70%", "height": "70%", "margin": "0.2em", "alignSelf": "center"}} src={`logo_bandas/desmebramiento.svg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "paddingTop": "0.5em", "paddingBottom": "0.5em", "paddingRight": "0.5em"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesText as={`p`} css={{"fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Desmembramiento - Maldita Enfermedad`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Desmembramiento es una banda de Death Metal originario de Tegucigalpa, Honduras.`}
</RadixThemesText>
</RadixThemesFlex>
  <Link_b6edeccad733a90423e845edf202d88f/>
</RadixThemesFlex>
</RadixThemesBox>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} direction={`row`} gap={`3`}>
  <RadixThemesBox css={{"width": "100%"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "background": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}} direction={`column`} gap={`3`}>
  <img alt={`Krisis - Johd Ass`} css={{"width": "50%", "height": "50%", "margin": "0.2em", "alignSelf": "center"}} src={`logo_bandas/krisis.svg`}/>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"alignItems": "center", "paddingTop": "0.5em", "paddingBottom": "0.5em", "paddingRight": "0.5em"}} direction={`column`} gap={`0.5em`}>
  <RadixThemesText as={`p`} css={{"fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Krisis - Johd Ass`}
</RadixThemesText>
  <RadixThemesText as={`p`} css={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Krisis es una banda de Grind/Death metal originario de San Pedro Sula, Honduras.`}
</RadixThemesText>
</RadixThemesFlex>
  <Link_ffe9ab6cc542f7c175bd3de3a21b7530/>
</RadixThemesFlex>
</RadixThemesBox>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesHeading css={{"color": "#fff8ee", "fontFamily": "Poppins", "--default-font-family": "Poppins", "fontWeight": "500", "width": "100%", "paddingTop": "1em", "fontSize": "1.5em"}}>
  {`Contacto`}
</RadixThemesHeading>
  <Link_ae36edc148075f3fa5c37c115bf5cdcd/>
</RadixThemesFlex>
</RadixThemesFlex>
</RadixThemesFlex>
  <RadixThemesFlex css={{"display": "flex", "alignItems": "center", "justifyContent": "center"}}>
  <RadixThemesFlex align={`start`} className={`rx-Stack`} css={{"width": "100%", "alignItems": "center", "marginBottom": "0.8em", "paddingBotoom": "0.5em", "paddingInlineStart": "2.2em", "paddingInlineEnd": "2.2em", "color": "#99948e"}} direction={`column`} gap={`0px !important`}>
  <Link_c0dd49c77b7cfd083d76e485059fd9f4/>
  <RadixThemesText as={`p`} css={{"fontSize": "0.8em"}}>
  {`Gracias por visitar mi pagina web! ╰(*°▽°*)╯`}
</RadixThemesText>
  <RadixThemesFlex css={{"display": "flex", "alignItems": "center", "justifyContent": "center"}}>
  <RadixThemesText as={`p`} css={{"fontSize": "0.8em"}}>
  {` © 2023-2024`}
</RadixThemesText>
</RadixThemesFlex>
</RadixThemesFlex>
</RadixThemesFlex>
</RadixThemesBox>
  <NextHead>
  <title>
  {`Daniel Banariba | Desarrollador de Software y edición de videos`}
</title>
  <meta content={`Hola! mi nombre es Daniel Alejandro Barrientos Anariba soy un programador amante de la tecnologia, el cine y la música.`} name={`description`}/>
  <meta content={`avatar.jpeg`} property={`og:image`}/>
</NextHead>
</Fragment>
  )
}
