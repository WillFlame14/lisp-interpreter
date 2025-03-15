(let [empty? (fn [list] (= (count list) 0))
      cmap (fn rec [f list]
             (if (empty? list)
               list
               (let [head (peek list)
                     rest (pop list)]
                 (cons (f head) (rec f rest)))))]
  (nth (cmap (fn [x] (+ x 2)) (quote (1 2 3 4 5))) 0))