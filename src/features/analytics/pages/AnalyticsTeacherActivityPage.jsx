const AnalyticsTeacherActivityPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <article className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
        <h3 className="mb-3 text-[34px] font-semibold leading-none text-[#1f3f93]">Teacher Activity</h3>
        <div className="grid h-[420px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
          Teacher activity charts placeholder
        </div>
      </article>

      <article className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
        <h3 className="mb-3 text-[30px] font-semibold leading-none text-[#1f3f93]">
          Session and Assignment Insights
        </h3>
        <div className="grid h-[260px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
          Insights placeholder
        </div>
      </article>
    </div>
  );
};

export default AnalyticsTeacherActivityPage;
