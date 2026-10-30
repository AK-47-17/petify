import { notFound } from 'next/navigation';
import Petify from '../petify';
const pages=['services','adopt','shop','journal','partners','account','admin','privacy','terms'];
export default async function Page({params}:{params:Promise<{slug:string[]}>}){const {slug}=await params;if(slug.length!==1 || !pages.includes(slug[0]))notFound();return <Petify page={slug[0]}/>}
