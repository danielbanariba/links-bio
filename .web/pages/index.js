
/** @jsxImportSource @emotion/react */import { Fragment } from "react"
import { Fragment_fd0e7cb8f9fb4669a6805377d925fba0 } from "/utils/stateful_components"
import { Avatar, Box, Button, Center, Container, Heading, HStack, Image as ChakraImage, Link, Spacer, Text, VStack } from "@chakra-ui/react"
import Script from "next/script"
import "focus-visible/dist/focus-visible"
import NextLink from "next/link"
import NextHead from "next/head"



export default function Component() {

  return (
    <Fragment>
  <Fragment_fd0e7cb8f9fb4669a6805377d925fba0/>
  <Box>
  <Script strategy={`afterInteractive`}>
  {`document.documentElement.lang='es'`}
</Script>
  <HStack sx={{"position": "sticky", "bg": "#0a121f", "paddingX": "2.2em", "paddingY": "1em", "zIndex": "999", "top": "0"}}>
  <Box sx={{"fontFamily": "DinaRemasterII", "fontWeight": "500", "fontSize": "2.2em"}}>
  <Text as={`span`} sx={{"color": "#f1d700"}}>
  {`{`}
</Text>
  <Text as={`span`} sx={{"color": "#c398f4"}}>
  {`daniel_banariba`}
</Text>
  <Text as={`span`} sx={{"color": "#f1d700"}}>
  {`}`}
</Text>
  <Text as={`span`} sx={{"color": "#bbbbbb"}}>
  {`;`}
</Text>
</Box>
</HStack>
  <Center>
  <VStack sx={{"maxWidth": "750px", "width": "100%", "marginY": "2.2em", "padding": "0px !important"}}>
  <VStack alignItems={`start`} spacing={`1.5em`} sx={{"width": "100%", "paddingRight": "2.2em", "paddingLeft": "2.2em"}}>
  <HStack spacing={`1em`}>
  <Avatar name={`Daniel Banariba`} size={`2xl`} src={`avatar.jpg`} sx={{"color": "#ccc6be", "bg": "#0a121f", "padding": "2px", "border": "4px", "borderColor": "#0073a8", "alignItems": "start"}}/>
  <VStack alignItems={`start`} sx={{"width": "100%"}}>
  <Heading sx={{"fontSize": "2.2em", "color": "#fff8ee", "fontFamily": "Poppins", "fontWeight": "500"}}>
  {`Daniel Banariba`}
</Heading>
  <Text sx={{"marginTop": "0px !important", "color": "#0073a8", "fontSize": "1.1em"}}>
  {`@danielbanariba`}
</Text>
  <Box sx={{"display": ["none", "block", "block", "block"]}}>
  <HStack spacing={`1.7em`}>
  <Link as={NextLink} href={`https://github.com/danielbanariba`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .github-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .github-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"github-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>GitHub</title>\n                        <path d=\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.instagram.com/danielbanariba/`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .instagram-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .instagram-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"instagram-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Instagram</title>\n                        <path d=\"M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.facebook.com/profile.php?id=100063668491929`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .facebook-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .facebook-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"facebook-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Facebook</title>\n                        <path d=\"M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5V334.2H141.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H287V510.1C413.8 494.8 512 386.9 512 256h0z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.youtube.com/channel/UCa5U18nMgHUsqg-zsE1779Q`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .youtube-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .youtube-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"youtube-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Youtube</title>\n                        <path d=\"M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.tiktok.com/@danielbanariba`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .tiktok-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .tiktok-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"tiktok-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>TikTok</title>\n                        <path d=\"M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.linkedin.com/in/danielbanariba/`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .linkedin-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .linkedin-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"linkedin-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>LinkedIn</title>\n                        <path d=\"M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z\"/>\n                    </svg>\n            "}}/>
</Link>
</HStack>
</Box>
</VStack>
</HStack>
  <Box sx={{"display": ["block", "none", "none", "none"]}}>
  <Container centerContent={true} sx={{"spacing": "3em"}}>
  <VStack>
  <HStack spacing={`1.7em`}>
  <Link as={NextLink} href={`https://github.com/danielbanariba`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .github-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .github-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"github-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>GitHub</title>\n                        <path d=\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.instagram.com/danielbanariba/`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .instagram-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .instagram-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"instagram-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Instagram</title>\n                        <path d=\"M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.facebook.com/profile.php?id=100063668491929`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .facebook-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .facebook-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"facebook-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Facebook</title>\n                        <path d=\"M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5V334.2H141.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H287V510.1C413.8 494.8 512 386.9 512 256h0z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.youtube.com/channel/UCa5U18nMgHUsqg-zsE1779Q`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .youtube-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .youtube-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"youtube-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>Youtube</title>\n                        <path d=\"M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.tiktok.com/@danielbanariba`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .tiktok-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .tiktok-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"tiktok-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>TikTok</title>\n                        <path d=\"M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z\"/>\n                    </svg>\n            "}}/>
</Link>
  <Link as={NextLink} href={`https://www.linkedin.com/in/danielbanariba/`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Box dangerouslySetInnerHTML={{"__html": "\n                <style>\n                    .linkedin-icon {\n                        fill: #fff8ee;\n                        /* Establece un tamaño fijo para el SVG */\n                        width: 1.7em;\n                        height: 1.7em;\n                    }\n                    .linkedin-icon:hover {\n                        fill: #022b44;\n                    }\n                </style>\n                    <svg class=\"linkedin-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\">\n                        <title>LinkedIn</title>\n                        <path d=\"M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z\"/>\n                    </svg>\n            "}}/>
</Link>
</HStack>
</VStack>
</Container>
</Box>
  <HStack sx={{"width": "100%", "paddingRight": "2.2em"}}>
  <Box sx={{"fontSize": "1em", "color": "#ccc6be"}}>
  <Text as={`span`} sx={{"fontWeight": "bold", "color": "#0073a8"}}>
  {`2+`}
</Text>
  {`Años de experiencia programando`}
</Box>
  <Spacer/>
  <Box sx={{"fontSize": "1em", "color": "#ccc6be"}}>
  <Text as={`span`} sx={{"fontWeight": "bold", "color": "#0073a8"}}>
  {`5+`}
</Text>
  {`Años de experiencia editando y filmando videos`}
</Box>
  <Spacer/>
  <Box sx={{"fontSize": "1em", "color": "#ccc6be"}}>
  <Text as={`span`} sx={{"fontWeight": "bold", "color": "#0073a8"}}>
  {`+6000 `}
</Text>
  {`Suscriptores en Youtube`}
</Box>
</HStack>
  <Text sx={{"fontSize": "1.1em", "color": "#ccc6be", "width": "100%"}}>
  {`Soy un programador amante de la música extrema y la música en general, me encanta el septimo arte
            y todo lo que conlleva que sea edicion, filmacion, y direccion, he trabajado con multiples bandas al rededor de mi carrera
            haciendo trabajos como videos músicales, live seccion, grabaciones en vivo y documentales.
            `}
</Text>
</VStack>
  <VStack spacing={`1em`} sx={{"width": "100%", "paddingRight": "2.2em", "paddingLeft": "2.2em"}}>
  <Heading sx={{"width": "100%", "paddingTop": "1em", "fontSize": "1.5em", "color": "#fff8ee", "fontFamily": "Poppins", "fontWeight": "500"}}>
  {`Proyectos audiovisuales`}
</Heading>
  <HStack>
  <HStack>
  <Box sx={{"width": "100%"}}>
  <VStack sx={{"bg": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}}>
  <ChakraImage alt={`Blasfemia - Inmaculada Concepción`} src={`logo_bandas/blasfemia.svg`} sx={{"width": "40%", "height": "40%", "margin": "0.2em"}}/>
  <VStack alignItems={`center`} spacing={`0.5em`} sx={{"paddingY": "0.5em", "paddingRight": "0.5em"}}>
  <Text sx={{"fontFamily": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Blasfemia - Inmaculada Concepción`}
</Text>
  <Text sx={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Blasfemia es una banda de Brutal Death Metal originario de Tegucigalpa, Honduras.`}
</Text>
</VStack>
  <Link as={NextLink} href={`https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <ChakraImage alt={`Blasfemia - Inmaculada Concepción`} src={`img_video/blasfemia.jpg`} sx={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "_hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}}/>
</Link>
</VStack>
</Box>
</HStack>
</HStack>
  <HStack>
  <HStack>
  <Box sx={{"width": "100%"}}>
  <VStack sx={{"bg": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}}>
  <ChakraImage alt={`Sobreporrosis - Acá no es Party Sesiones`} src={`logo_bandas/sobreporrosis.svg`} sx={{"width": "60%", "height": "60%", "margin": "0.2em"}}/>
  <VStack alignItems={`center`} spacing={`0.5em`} sx={{"paddingY": "0.5em", "paddingRight": "0.5em"}}>
  <Text sx={{"fontFamily": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Sobreporrosis - Acá no es Party Sesiones`}
</Text>
  <Text sx={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Sobreporrosis es una banda de Punk Rock originario de Tegucigalpa, Honduras.`}
</Text>
</VStack>
  <Link as={NextLink} href={`https://youtu.be/vE5s7QdB95I?si=KntI0wqkG7Qj3XVF`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <ChakraImage alt={`Sobreporrosis - Acá no es Party Sesiones`} src={`img_video/sobreporrosis.jpg`} sx={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "_hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}}/>
</Link>
</VStack>
</Box>
</HStack>
</HStack>
  <HStack>
  <HStack>
  <Box sx={{"width": "100%"}}>
  <VStack sx={{"bg": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}}>
  <ChakraImage alt={`Lesath - El Enviado de Satán`} src={`logo_bandas/lesath.svg`} sx={{"width": "30%", "height": "30%", "margin": "0.2em"}}/>
  <VStack alignItems={`center`} spacing={`0.5em`} sx={{"paddingY": "0.5em", "paddingRight": "0.5em"}}>
  <Text sx={{"fontFamily": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Lesath - El Enviado de Satán`}
</Text>
  <Text sx={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Lesath es una banda de Death Metal Melódico originario de Tegucigalpa, Honduras.`}
</Text>
</VStack>
  <Link as={NextLink} href={`https://youtu.be/EAZR_GLTHyw`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <ChakraImage alt={`Lesath - El Enviado de Satán`} src={`img_video/lesath.jpg`} sx={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "_hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}}/>
</Link>
</VStack>
</Box>
</HStack>
</HStack>
  <HStack>
  <HStack>
  <Box sx={{"width": "100%"}}>
  <VStack sx={{"bg": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}}>
  <ChakraImage alt={`Desmembramiento - Maldita Enfermedad`} src={`logo_bandas/desmebramiento.svg`} sx={{"width": "70%", "height": "70%", "margin": "0.2em"}}/>
  <VStack alignItems={`center`} spacing={`0.5em`} sx={{"paddingY": "0.5em", "paddingRight": "0.5em"}}>
  <Text sx={{"fontFamily": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Desmembramiento - Maldita Enfermedad`}
</Text>
  <Text sx={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Desmembramiento es una banda de Death Metal originario de Tegucigalpa, Honduras.`}
</Text>
</VStack>
  <Link as={NextLink} href={`https://youtu.be/lvH-dy-Gn0Y`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <ChakraImage alt={`Desmembramiento - Maldita Enfermedad`} src={`img_video/desmembramiento.webp`} sx={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "_hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}}/>
</Link>
</VStack>
</Box>
</HStack>
</HStack>
  <HStack>
  <HStack>
  <Box sx={{"width": "100%"}}>
  <VStack sx={{"bg": "#0a121f", "padding": "1em", "borderRadius": "0.5em", "width": "100%"}}>
  <ChakraImage alt={`Krisis - Johd Ass`} src={`logo_bandas/krisis.svg`} sx={{"width": "50%", "height": "50%", "margin": "0.2em"}}/>
  <VStack alignItems={`center`} spacing={`0.5em`} sx={{"paddingY": "0.5em", "paddingRight": "0.5em"}}>
  <Text sx={{"fontFamily": "Poppins", "fontWeight": "500", "fontSize": "1.5em", "color": "#fff8ee"}}>
  {`Krisis - Johd Ass`}
</Text>
  <Text sx={{"fontWeight": "300", "fontSize": "1.1em", "color": "#ccc6be"}}>
  {`Krisis es una banda de Grind/Death metal originario de San Pedro Sula, Honduras.`}
</Text>
</VStack>
  <Link as={NextLink} href={`https://youtu.be/548LqsbFhSw`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <ChakraImage alt={`Krisis - Johd Ass`} src={`img_video/krisis.webp`} sx={{"width": "auto", "height": "auto", "margin": "auto", "borderRadius": "1em", "_hover": {"transform": "scale(1.1)", "transition": "transform 0.2s"}}}/>
</Link>
</VStack>
</Box>
</HStack>
</HStack>
  <Heading sx={{"width": "100%", "paddingTop": "1em", "fontSize": "1.5em", "color": "#fff8ee", "fontFamily": "Poppins", "fontWeight": "500"}}>
  {`Contacto`}
</Heading>
  <Link as={NextLink} href={`mailto:danielbanariba@protonmail.com`} isExternal={true} sx={{"width": "100%", "textDecoration": "none", "_hover": {}}}>
  <Button sx={{"width": "100%", "height": "100%", "padding": "0.5em", "borderRadius": "1em", "color": "#fff8ee", "backgroundColor": "#0a121f", "whiteSpace": "normal", "textAlign": "start", "_hover": {"backgroundColor": "#022b44"}}}>
  <HStack sx={{"width": "100%"}}>
  <ChakraImage alt={`Email`} src={`icons/email.svg`} sx={{"width": "1.5em", "height": "1.5em", "margin": "0.8em"}}/>
  <VStack alignItems={`start`} spacing={`0.5em`} sx={{"paddingY": "0.5em", "paddingRight": "0.5em"}}>
  <Text sx={{"fontFamily": "Poppins", "fontWeight": "500", "fontSize": "1em", "color": "#fff8ee"}}>
  {`Email`}
</Text>
  <Text sx={{"fontWeight": "300", "fontSize": "0.8em", "color": "#ccc6be"}}>
  {`danielbanariba@protonmail.com`}
</Text>
</VStack>
</HStack>
</Button>
</Link>
</VStack>
</VStack>
</Center>
  <VStack spacing={`0px !important`} sx={{"marginBottom": "0.8em", "paddingBotoom": "0.5em", "paddingX": "2.2em", "color": "#99948e"}}>
  <Link as={NextLink} href={`https://www.danielbanariba.com`} isExternal={true} sx={{"target": "_blank", "fontSize": "1em", "textDecoration": "none", "_hover": {}}}>
  <Box>
  <Text as={`span`} sx={{"fontFamily": "Pulse_virgin", "fontWeight": "500", "fontSize": "1.7em", "color": "#908986", "_hover": {"color": "#045b90"}, "alt": "Logotipo de DanielBanariba."}}>
  {`DANIEL
BANARIBA`}
</Text>
</Box>
</Link>
  <Text as={`span`} sx={{"fontSize": "0.8em"}}>
  {`Gracias por visitar mi pagina web! ╰(*°▽°*)╯`}
</Text>
  <Center>
  <Text as={`span`} sx={{"fontSize": "0.8em"}}>
  {` © 2023-2023`}
</Text>
</Center>
</VStack>
</Box>
  <NextHead>
  <title>
  {`Daniel Banariba | Desarrollador de Software y edición de videos`}
</title>
  <meta content={`Hola!, mi nombre es Daniel Banariba. Soy programador amante de la tecnologia, el cine y la música.`} name={`description`}/>
  <meta content={`avatar.jpeg`} property={`og:image`}/>
</NextHead>
</Fragment>
  )
}
