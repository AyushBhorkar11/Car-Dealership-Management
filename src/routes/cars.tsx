import {createFileRoute,Outlet} from '@tanstack/react-router';
export const Route=createFileRoute('/cars')({component:()=> <Outlet/>});
